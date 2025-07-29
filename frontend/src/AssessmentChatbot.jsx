import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Modal from 'react-modal'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Navbar from './components/Navbar'
import Button from './components/Button'
import toast from 'react-hot-toast'
import { MAX_FULLSCREEN_WARNINGS, MAX_TAB_SWITCHES } from './utils/constants'
import AssessmentMessages from './components/AssessmentMessages'
import {
  formatTime,
  handleAnswerSubmit,
  fetchNextQuestion,
  endAssessment,
  captureSnapshot,
  requestFullscreen,
  parseContent,
  renderContent,
  baseUrl,
} from './utils/utils'
import {
  BookOpen,
  Clock,
  Star,
  Camera,
  Home,
  StopCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'
import Webcam from 'react-webcam'

// Bind Modal to the root element for accessibility
Modal.setAppElement('#root')

const VIDEO_WIDTH = 400
const VIDEO_HEIGHT = 300
const videoConstraints = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  facingMode: 'environment',
}
const COOLDOWN_SECONDS = {
  multiPerson: 10,
  cellPhone: 10,
  noPerson: 10,
}
const NO_PERSON_TIMEOUT = 10

const AssessmentChatbot = () => {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [skill, setSkill] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [isAssessmentComplete, setIsAssessmentComplete] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [questionPending, setQuestionPending] = useState(false)
  const [awaitingNextQuestion, setAwaitingNextQuestion] = useState(false)
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0)
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false)
  const [fullscreenPermissionError, setFullscreenPermissionError] =
    useState(false)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [webcamError, setWebcamError] = useState('')
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(null)
  const [usedMcqIds, setUsedMcqIds] = useState([])
  const [model, setModel] = useState(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [capturedImg, setCapturedImg] = useState(null)
  const [lastPersonDetected, setLastPersonDetected] = useState(Date.now())
  const initialStartComplete = useRef(false)
  const currentMcqId = useRef(null)
  const chatContainerRef = useRef(null)
  const assessmentContainerRef = useRef(null)
  const modalButtonRef = useRef(null)
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const initialTimeLeft = useRef(null)
  const snapshotScheduled = useRef(false)
  const snapshotTimersRef = useRef([])
  const tabSwitchesRef = useRef(tabSwitches)
  const fullscreenWarningsRef = useRef(fullscreenWarnings)
  const cooldownRef = useRef({
    multiPerson: 0,
    cellPhone: 0,
    noPerson: 0,
  })
  const violationQueue = useRef([])
  const isProcessing = useRef(false)

  // Load COCO-SSD model
  useEffect(() => {
    async function loadModel() {
      setModelLoading(true)
      try {
        const loadedModel = await cocoSsd.load()
        setModel(loadedModel)
      } catch (error) {
        toast.error('Failed to load object detection model')
      } finally {
        setModelLoading(false)
      }
    }
    loadModel()
  }, [])

  // Draw Predictions
  const drawPredictions = useCallback((predictions) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
      ctx.font = '16px Arial'
      predictions.forEach((pred) => {
        ctx.beginPath()
        ctx.rect(...pred.bbox)
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        ctx.fillStyle = 'red'
        ctx.stroke()
        ctx.fillText(
          `${pred.class} (${Math.round(pred.score * 100)}%)`,
          pred.bbox[0],
          pred.bbox[1] > 10 ? pred.bbox[1] - 5 : 10
        )
      })
    }
  }, [])

  // Capture Violation Image
  const captureImage = useCallback(
    async (violationType, imageSrc) => {
      try {
        const response = await fetch(imageSrc)
        const blob = await response.blob()
        const formData = new FormData()
        formData.append('snapshot', blob, 'snapshot.jpg')
        formData.append('violation_type', violationType)

        const response2 = await fetch(
          `${baseUrl}/assessment/store-violation/${attemptId}`,
          {
            method: 'POST',
            body: formData,
            credentials: 'include',
          }
        )
        const data = await response2.json()
        if (data.error) {
          toast.error(data.error)
        } else {
          toast.success('Violation recorded successfully')
        }
      } catch (error) {
        toast.error('Failed to record violation')
        console.error('Error:', error)
      }
    },
    [attemptId]
  )

  // Process Violation Queue
  const processViolationQueue = useCallback(async () => {
    if (isProcessing.current || violationQueue.current.length === 0) return

    isProcessing.current = true
    const { violationType, imageSrc } = violationQueue.current.shift()
    await captureImage(violationType, imageSrc)
    isProcessing.current = false

    if (violationQueue.current.length > 0) {
      processViolationQueue()
    }
  }, [captureImage])

  // Queue Violation
  const queueViolation = useCallback(
    (violationType) => {
      if (webcamRef.current && webcamRef.current.video) {
        const imageSrc = webcamRef.current.getScreenshot()
        setCapturedImg(imageSrc)
        violationQueue.current.push({ violationType, imageSrc })
        processViolationQueue()
      }
    },
    [processViolationQueue]
  )

  // Detection loop
  useEffect(() => {
    let animationId
    const detectFrame = async () => {
      if (
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4 &&
        model
      ) {
        const predictions = await model.detect(webcamRef.current.video)
        drawPredictions(predictions)

        // Person Check
        const personCount = predictions.filter(
          (p) => p.class.toLowerCase() === 'person'
        ).length

        // Multi-Person Cooldown
        if (personCount > 1) {
          const now = Date.now()
          if (
            now - cooldownRef.current.multiPerson >
            COOLDOWN_SECONDS.multiPerson * 1000
          ) {
            cooldownRef.current.multiPerson = now
            toast.error('Multiple persons detected!', {
              autoClose: 2000,
              position: 'top-center',
            })
            queueViolation('multiple_faces')
          }
        }

        // No Person Tracking
        if (personCount > 0) {
          setLastPersonDetected(Date.now())
        }

        // Cell Phone Cooldown
        const cellPhoneFound = predictions.some(
          (p) => p.class.toLowerCase() === 'cell phone'
        )
        if (cellPhoneFound) {
          const now = Date.now()
          if (
            now - cooldownRef.current.cellPhone >
            COOLDOWN_SECONDS.cellPhone * 1000
          ) {
            cooldownRef.current.cellPhone = now
            toast.error('Cell phone detected!', {
              autoClose: 2000,
              position: 'top-center',
            })
            queueViolation('mobile_phone')
          }
        }

        // No Person Cooldown
        const secondsSince = (Date.now() - lastPersonDetected) / 1000
        if (personCount === 0 && secondsSince > NO_PERSON_TIMEOUT) {
          const now = Date.now()
          if (
            now - cooldownRef.current.noPerson >
            COOLDOWN_SECONDS.noPerson * 1000
          ) {
            cooldownRef.current.noPerson = now
            toast('No person detected for too long!', {
              autoClose: 2500,
              position: 'top-center',
              style: {
                background: '#fef3c7',
                color: '#b45309',
              },
            })
            queueViolation('no_face')
          }
        }
      }
      animationId = requestAnimationFrame(detectFrame)
    }

    if (model) {
      animationId = requestAnimationFrame(detectFrame)
    }
    return () => cancelAnimationFrame(animationId)
  }, [model, queueViolation, drawPredictions, lastPersonDetected])

  useEffect(() => {
    tabSwitchesRef.current = tabSwitches
  }, [tabSwitches])

  useEffect(() => {
    fullscreenWarningsRef.current = fullscreenWarnings
  }, [fullscreenWarnings])

  const scheduleSnapshots = () => {
    if (
      !initialStartComplete.current ||
      initialTimeLeft.current === null ||
      !streamRef.current ||
      isAssessmentComplete ||
      snapshotScheduled.current
    )
      return

    snapshotScheduled.current = true
    const numSnapshots = Math.floor(Math.random() * 3) + 3
    const intervals = Array.from(
      { length: numSnapshots },
      () => Math.trunc(Math.random() * initialTimeLeft.current * 1000) / 10
    ).sort((a, b) => a - b)

    snapshotTimersRef.current = intervals.map((interval) =>
      setTimeout(async () => {
        if (
          !isAssessmentComplete &&
          streamRef.current &&
          webcamRef.current?.video
        ) {
          try {
            await captureSnapshot(
              attemptId,
              webcamRef,
              () => {},
              () => {}
            )
          } catch (error) {
            toast.error('Failed to capture snapshot')
          }
        }
      }, interval)
    )
  }

  const startAssessment = async () => {
    setIsLoading(true)
    setErrorMessage('')
    setMessages([])
    setUserAnswer('')
    setQuestionNumber(0)
    setCurrentQuestion(null)
    setQuestionPending(false)
    setAwaitingNextQuestion(false)
    setIsAssessmentComplete(false)
    setIsGeneratingQuestion(false)
    setQuestionStartTime(null)
    setUsedMcqIds([])
    setFullscreenWarnings(0)
    setTabSwitches(0)
    setShowFullscreenWarning(false)
    setFullscreenPermissionError(false)
    setWebcamError('')
    initialStartComplete.current = false
    initialTimeLeft.current = null
    snapshotScheduled.current = false
    snapshotTimersRef.current.forEach(clearTimeout)
    snapshotTimersRef.current = []
    violationQueue.current = []
    isProcessing.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (webcamRef.current) webcamRef.current.video.srcObject = stream

      const response = await fetch(`${baseUrl}/assessment/start/${attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!response.ok)
        throw new Error(
          (await response.json()).error || `HTTP error ${response.status}`
        )
      const data = await response.json()
      if (!data.test_duration) throw new Error('test_duration not provided')
      setTotalQuestions(data.total_questions || 0)
      setTimeLeft(data.test_duration)
      initialTimeLeft.current = data.test_duration
      initialStartComplete.current = true
      scheduleSnapshots()
      await requestFullscreen().catch((err) => {
        setFullscreenPermissionError(true)
        setShowFullscreenWarning(true)
        toast.error('Failed to enter fullscreen mode')
      })
    } catch (error) {
      if (
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError'
      ) {
        setWebcamError(
          'Webcam access denied. Please allow webcam access to continue.'
        )
        toast.error(webcamError)
      } else {
        setErrorMessage(
          `Failed to start the assessment: ${error.message}. Please retry or return to dashboard.`
        )
        toast.error(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      snapshotTimersRef.current.forEach(clearTimeout)
      snapshotTimersRef.current = []
      snapshotScheduled.current = false
      if (streamRef.current)
        streamRef.current.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const handleFullscreenChange = () => {
    if (
      !document.fullscreenElement &&
      !isAssessmentComplete &&
      initialStartComplete.current
    ) {
      setFullscreenWarnings((prev) => {
        const newCount = prev + 1
        if (newCount > MAX_FULLSCREEN_WARNINGS) {
          endAssessment(
            attemptId,
            true,
            'Terminated due to repeated fullscreen exits',
            setIsAssessmentComplete,
            setIsLoading,
            setErrorMessage,
            {
              tabSwitches: tabSwitchesRef.current,
              fullscreenWarnings: newCount,
            },
            () => navigate(`/candidate/assessment/${attemptId}/results`)
          )
        } else {
          setShowFullscreenWarning(true)
          toast.error(
            `Exited fullscreen mode (${newCount}/${MAX_FULLSCREEN_WARNINGS})`
          )
        }
        return newCount
      })
    }
  }

  const handleVisibilityChange = () => {
    if (
      document.hidden &&
      !isAssessmentComplete &&
      initialStartComplete.current
    ) {
      setTabSwitches((prev) => {
        const newCount = prev + 1
        if (newCount >= MAX_TAB_SWITCHES) {
          endAssessment(
            attemptId,
            true,
            'Terminated due to repeated tab switches',
            setIsAssessmentComplete,
            setIsLoading,
            setErrorMessage,
            {
              tabSwitches: newCount,
              fullscreenWarnings: fullscreenWarningsRef.current,
            },
            () => navigate(`/candidate/assessment/${attemptId}/results`)
          )
        } else {
          toast.error(`Tab switch detected (${newCount}/${MAX_TAB_SWITCHES})`)
        }
        return newCount
      })
    }
  }

  useEffect(() => {
    if (showFullscreenWarning && modalButtonRef.current)
      modalButtonRef.current.focus()
  }, [showFullscreenWarning])

  useEffect(() => {
    if (isAssessmentComplete)
      navigate(`/candidate/assessment/${attemptId}/results`)
  }, [isAssessmentComplete, attemptId, navigate])

  useEffect(() => {
    if (attemptId) startAssessment()
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const preventCopyPaste = (e) => {
      e.preventDefault()
      toast.error('Copy/paste is not allowed during the assessment')
    }
    document.addEventListener('copy', preventCopyPaste)
    document.addEventListener('paste', preventCopyPaste)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      )
      document.removeEventListener(
        'mozfullscreenchange',
        handleFullscreenChange
      )
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('copy', preventCopyPaste)
      document.removeEventListener('paste', preventCopyPaste)
    }
  }, [attemptId])

  useEffect(() => {
    if (
      initialStartComplete.current &&
      !questionPending &&
      !currentQuestion &&
      !isAssessmentComplete &&
      !awaitingNextQuestion
    ) {
      fetchNextQuestion(
        attemptId,
        setCurrentQuestion,
        setSkill,
        setQuestionNumber,
        setMessages,
        setIsAssessmentComplete,
        setIsLoading,
        setQuestionPending,
        setErrorMessage,
        setQuestionStartTime,
        setUsedMcqIds,
        usedMcqIds,
        questionNumber,
        setIsGeneratingQuestion,
        {
          tabSwitches: tabSwitchesRef.current,
          fullscreenWarnings: fullscreenWarningsRef.current,
          forced: false,
          remark: 'None',
        }
      )
    }
  }, [
    attemptId,
    initialStartComplete.current,
    questionPending,
    currentQuestion,
    isAssessmentComplete,
    awaitingNextQuestion,
    usedMcqIds,
    questionNumber,
  ])

  useEffect(() => {
    if (
      awaitingNextQuestion &&
      !questionPending &&
      !isLoading &&
      !isAssessmentComplete
    ) {
      setTimeout(() => {
        fetchNextQuestion(
          attemptId,
          setCurrentQuestion,
          setSkill,
          setQuestionNumber,
          setMessages,
          setIsAssessmentComplete,
          setIsLoading,
          setQuestionPending,
          setErrorMessage,
          setQuestionStartTime,
          setUsedMcqIds,
          usedMcqIds,
          questionNumber,
          setIsGeneratingQuestion,
          {
            tabSwitches: tabSwitchesRef.current,
            fullscreenWarnings: fullscreenWarningsRef.current,
            forced: false,
            remark: 'None',
          }
        )
        setAwaitingNextQuestion(false)
      }, 1500)
    }
  }, [
    awaitingNextQuestion,
    questionPending,
    isLoading,
    isAssessmentComplete,
    attemptId,
    questionNumber,
    usedMcqIds,
  ])

  useEffect(() => {
    if (timeLeft !== null) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(timer)
            endAssessment(
              attemptId,
              false,
              '',
              setIsAssessmentComplete,
              setIsLoading,
              setErrorMessage,
              {
                tabSwitches: tabSwitchesRef.current,
                fullscreenWarnings: fullscreenWarningsRef.current,
              },
              () => navigate(`/candidate/assessment/${attemptId}/results`)
            )
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeLeft, attemptId, navigate])

  useEffect(() => {
    if (chatContainerRef.current)
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
  }, [messages])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col font-sans">
      <div className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Sidebar */}
          <div className="w-full md:w-[25%] bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Assessment
              </h2>
            </div>
            <div className="space-y-6 flex-1">
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Clock className="w-5 h-5 text-indigo-500" />
                <span>Time Left: {formatTime(timeLeft)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Star className="w-5 h-5 text-indigo-500" />
                <span>
                  Question {questionNumber} of {totalQuestions}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Camera className="w-5 h-5 text-indigo-500" />
                <span>
                  Tab Switches: {tabSwitches}/{MAX_TAB_SWITCHES}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Camera className="w-5 h-5 text-indigo-500" />
                <span>
                  Fullscreen Warnings: {fullscreenWarnings}/
                  {MAX_FULLSCREEN_WARNINGS}
                </span>
              </div>
              <div className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Proctoring
                  </h3>
                </div>
                <div className="relative w-full aspect-video bg-gray-100/80 dark:bg-gray-700/80 rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
                  <Webcam
                    ref={webcamRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    className="absolute top-0 left-0 w-full h-full"
                    style={{ pointerEvents: 'none' }}
                  />
                </div>
                {capturedImg && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Latest Violation Snapshot:
                    </div>
                    <img
                      src={capturedImg}
                      alt="Captured Violation"
                      className="w-full h-auto rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-auto space-y-4">
              <Button
                onClick={() => navigate('/candidate/dashboard')}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() =>
                  endAssessment(
                    attemptId,
                    false,
                    '',
                    setIsAssessmentComplete,
                    setIsLoading,
                    setErrorMessage,
                    {
                      tabSwitches: tabSwitchesRef.current,
                      fullscreenWarnings: fullscreenWarningsRef.current,
                    },
                    () => navigate(`/candidate/assessment/${attemptId}/results`)
                  )
                }
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-red-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
                disabled={isAssessmentComplete || isLoading}
              >
                <StopCircle className="w-5 h-5" />
                End Assessment
              </Button>
            </div>
          </div>

          {/* Chat Area */}
          <div className="w-full md:w-[75%] bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              Chat Interface
            </h2>
            {errorMessage && (
              <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-6 mb-8 rounded-2xl flex items-center gap-3 shadow-inner">
                <XCircle className="w-6 h-6" />
                <span className="text-base">{errorMessage}</span>
                <div className="ml-auto flex gap-4">
                  <Button
                    onClick={startAssessment}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Retry
                  </Button>
                  <Button
                    onClick={() => navigate('/candidate/dashboard')}
                    className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 flex items-center gap-2"
                  >
                    <Home className="w-5 h-5" />
                    Dashboard
                  </Button>
                </div>
              </div>
            )}
            {webcamError && (
              <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-6 mb-8 rounded-2xl flex items-center gap-3 shadow-inner">
                <XCircle className="w-6 h-6" />
                <span className="text-base">{webcamError}</span>
                <Button
                  onClick={() => navigate('/candidate/dashboard')}
                  className="ml-auto bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 flex items-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Dashboard
                </Button>
              </div>
            )}
            {(isLoading || isGeneratingQuestion || modelLoading) && (
              <div className="bg-gray-50/80 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600/50 p-6 mb-8 rounded-2xl flex items-center gap-3 justify-center shadow-inner">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-base text-gray-700 dark:text-gray-200">
                  {modelLoading
                    ? 'Loading object detection model...'
                    : isGeneratingQuestion
                    ? 'Generating your next question...'
                    : 'Loading...'}
                </span>
              </div>
            )}
            <AssessmentMessages
              messages={messages}
              isLoading={isLoading}
              currentQuestion={currentQuestion}
              userAnswer={userAnswer}
              handleOptionSelect={(value) => {
                setUserAnswer(value)
                currentMcqId.current = currentQuestion?.mcq_id
              }}
              handleAnswerSubmit={(e) =>
                handleAnswerSubmit(
                  e,
                  attemptId,
                  skill,
                  userAnswer,
                  currentQuestion,
                  setMessages,
                  setCurrentQuestion,
                  currentMcqId,
                  setUserAnswer,
                  setAwaitingNextQuestion,
                  setIsLoading,
                  setErrorMessage,
                  questionStartTime
                )
              }
              endAssessment={() =>
                endAssessment(
                  attemptId,
                  false,
                  '',
                  setIsAssessmentComplete,
                  setIsLoading,
                  setErrorMessage,
                  {
                    tabSwitches: tabSwitchesRef.current,
                    fullscreenWarnings: fullscreenWarningsRef.current,
                  },
                  () => navigate(`/candidate/assessment/${attemptId}/results`)
                )
              }
              chatContainerRef={chatContainerRef}
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={showFullscreenWarning}
        onRequestClose={() => {
          setShowFullscreenWarning(false)
          if (!fullscreenPermissionError) requestFullscreen()
        }}
        className="bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-300 p-6 rounded-2xl max-w-md w-full mx-auto mt-20 shadow-xl"
        overlayClassName="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center"
        aria={{
          labelledby: 'fullscreen-warning-title',
          describedby: 'fullscreen-warning-desc',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-6 h-6 text-yellow-600" />
          <h2 id="fullscreen-warning-title" className="text-lg font-semibold">
            Fullscreen Warning
          </h2>
        </div>
        <p id="fullscreen-warning-desc" className="text-base mb-6">
          {fullscreenPermissionError
            ? 'Failed to enter fullscreen mode. Please enable fullscreen to continue the assessment.'
            : `Warning: You have exited fullscreen mode (${fullscreenWarnings}/${MAX_FULLSCREEN_WARNINGS}). Please stay in fullscreen to continue.`}
        </p>
        <div className="flex justify-end">
          <Button
            ref={modalButtonRef}
            onClick={() => {
              setShowFullscreenWarning(false)
              if (!fullscreenPermissionError) requestFullscreen()
            }}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center gap-2"
          >
            {fullscreenPermissionError ? 'OK' : 'Re-enter Fullscreen'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default AssessmentChatbot
