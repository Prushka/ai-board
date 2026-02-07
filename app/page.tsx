"use client";

import * as React from "react";
import {motion, AnimatePresence} from "framer-motion";
import {ArrowRight, Copy, Loader2, Check, Languages as LanguagesIcon, Sparkles, Settings, Sun, Moon, Monitor, Upload, Mic, CornerDownRight, Zap, ClipboardPaste, Captions} from "lucide-react";
import { useTheme } from "next-themes";

import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import { SettingsDialog } from "@/components/settings-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Card, CardContent, CardFooter} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LoadingAnimation = () => {
    return (
        <div className="w-full h-full flex flex-col gap-3 p-2 select-none">
            {[0.9, 0.7, 0.85, 0.6, 0.8, 0.75].map((width, i) => (
                <motion.div
                    key={i}
                    className="h-3 md:h-4 rounded-full bg-muted/20 relative overflow-hidden origin-left"
                    style={{ width: `${width * 100}%` }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                    <motion.div
                        className="absolute inset-0 bg-linear-to-r from-transparent via-primary/20 to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.2,
                            repeatDelay: 0.5
                        }}
                    />
                </motion.div>
            ))}
        </div>
    )
}

const LANGUAGES = [
    "Chinese (Simplified)", "English", "Russian",
    "Japanese", "Korean",
    "Turkish", "French", "Kazakh",
    "Spanish", "German",
    "Italian", "Portuguese",
    "Chinese (Traditional)",
    "Arabic", "Hindi", "Dutch", "Polish", "Swedish",
    "Indonesian", "Vietnamese", "Thai"
]

type AppMode = 'translator' | 'polisher'

export default function TranslatorApp() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const [mode, setMode] = React.useState<AppMode>('translator')
    const [models, setModels] = React.useState<{ id: string }[]>([])
    const [selectedModel, setSelectedModel] = React.useState<string>("")
    const [selectedTranscriptionModel, setSelectedTranscriptionModel] = React.useState<string>("")
    const [selectedVisualModel, setSelectedVisualModel] = React.useState<string>("")

    const [targetLanguage, setTargetLanguage] = React.useState<string>(LANGUAGES[0])
    const [languageHistory, setLanguageHistory] = React.useState<string[]>([])
    const [isFastMode, setIsFastMode] = React.useState(true)

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
    const [selectedEndpoint, setSelectedEndpoint] = React.useState<string>("")

    const [contents, setContents] = React.useState<Record<AppMode, {
        input: string;
        output: string;
        tokens: { text: string; pronunciation: string }[];
    }>>({
        translator: { input: "", output: "", tokens: [] },
        polisher: { input: "", output: "", tokens: [] }
    })

    const inputText = contents[mode].input
    const translatedText = contents[mode].output
    const tokens = contents[mode].tokens

    const setInputText = (value: string) => {
        setContents(prev => ({
            ...prev,
            [mode]: { ...prev[mode], input: value }
        }))
    }
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isExtracting, setIsExtracting] = React.useState<boolean>(false)
    const [isCopied, setIsCopied] = React.useState<boolean>(false)
    const [isPronouncing, setIsPronouncing] = React.useState<boolean>(false)
    const [isRecording, setIsRecording] = React.useState<boolean>(false)

    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)

    const processImageFile = async (file: File) => {
        setIsExtracting(true)
        try {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string

                try {
                    const res = await fetch("/api/ocr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            image: base64,
                            endpoint: selectedEndpoint,
                            model: selectedVisualModel || selectedModel
                        })
                    })
                    const data = await res.json()

                    if (data.text) {
                        // Append text if there is existing text, or replace?
                        // User prompt "upload image to translator" usually implies replacing or adding.
                        // Let's replace for now based on previous implementation behavior, or append if user wants to mix?
                        // Previous implementation was `setInputText(data.text)`, so replacing.
                        setInputText(data.text)

                        if (mode === 'translator') {
                            handleAction(true, data.text)
                        }
                    } else if (data.error) {
                        console.error("OCR Error:", data.error)
                    }
                } catch (err) {
                    console.error("OCR Request Failed", err)
                } finally {
                    setIsExtracting(false)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                }
            }
            reader.readAsDataURL(file)
        } catch (e) {
            console.error("File reading failed", e)
            setIsExtracting(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processImageFile(file)
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    e.preventDefault()
                    await processImageFile(file)
                    return
                }
            }
        }
    }

    const handlePasteButton = async () => {
        try {
            if (typeof navigator.clipboard.read === 'function') {
                try {
                    const items = await navigator.clipboard.read()
                    for (const item of items) {
                        if (item.types.some(t => t.startsWith('image/'))) {
                            const blob = await item.getType(item.types.find(t => t.startsWith('image/'))!)
                            const file = new File([blob], "pasted-image.png", { type: blob.type })
                            await processImageFile(file)
                            return
                        }
                    }
                } catch {
                    // Ignore, fallback to text
                }
            }

            const text = await navigator.clipboard.readText()
            if (text) {
                setInputText(text)
                if (mode === 'translator') {
                    handleAction(true, text)
                }
            }
        } catch (e) {
            console.error("Paste failed", e)
        }
    }

    const handleMicClick = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const audioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                // Extension logic: if mimeType contains mp4 use mp4, else webm
                const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                const audioFile = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });

                setIsExtracting(true);
                try {
                    const formData = new FormData();
                    formData.append("file", audioFile);
                    formData.append("endpoint", selectedEndpoint);
                    formData.append("model", selectedTranscriptionModel || selectedModel);

                    const res = await fetch("/api/transcribe", {
                        method: "POST",
                        body: formData
                    });
                    const data = await res.json();

                    if (data.text) {
                        setInputText(data.text);
                        if (mode === 'translator') {
                            handleAction(true, data.text);
                        }
                    } else if (data.error) {
                        console.error("Transcription Error:", data.error);
                    }
                } catch (err) {
                    console.error("Transcription Request Failed", err);
                } finally {
                    setIsExtracting(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error("Audio recording failed", e);
            alert("Could not access microphone.");
        }
    }

    // Ref to track last successful translation parameters to prevent redundant requests
    const lastTranslatedParamsRef = React.useRef<{
        translator: {
            text: string;
            targetLanguage: string;
            model: string;
            previousLanguage?: string;
            endpoint?: string;
            isFastMode?: boolean;
            cachedTokens?: { text: string; pronunciation: string }[];
        } | null;
        polisher: {
            text: string;
            model: string;
            endpoint?: string;
            isFastMode?: boolean;
            cachedTokens?: { text: string; pronunciation: string }[];
        } | null;
    }>({
        translator: null,
        polisher: null
    })

    // Derived state for display
    const previousLanguage = React.useMemo(() =>
        languageHistory.find(l => l !== targetLanguage),
    [languageHistory, targetLanguage])

    // Load settings from local storage on mount
    React.useEffect(() => {
        const savedLang = localStorage.getItem("targetLanguage")
        const savedHistory = localStorage.getItem("languageHistory")
        const savedFastMode = localStorage.getItem("fastMode")

        if (savedFastMode !== null) {
            setIsFastMode(savedFastMode === "true")
        }

        const effectiveLang = savedLang || LANGUAGES[0]
        if (savedLang) setTargetLanguage(savedLang)

        let currentHistory: string[] = []
        if (savedHistory) {
            try {
                currentHistory = JSON.parse(savedHistory)
            } catch (e) {
                console.error("Failed to parse language history", e)
            }
        }

        // Ensure initial language is in history
        if (!currentHistory.includes(effectiveLang)) {
            currentHistory = [effectiveLang, ...currentHistory].slice(0, 10)
            // Save updated history to consistent with state
            localStorage.setItem("languageHistory", JSON.stringify(currentHistory))
        }

        setLanguageHistory(currentHistory)
    }, [])

    // Load endpoint from local storage and validate against available endpoints
    React.useEffect(() => {
        const initEndpoints = async () => {
            try {
                const res = await fetch("/api/endpoints")
                if (res.ok) {
                    const availableEndpoints: { id: string }[] = await res.json()
                    if (availableEndpoints.length > 0) {
                        const savedEndpoint = localStorage.getItem("selectedEndpoint")
                        const isValidSaved = savedEndpoint && availableEndpoints.some(e => e.id === savedEndpoint)

                        // If no saved endpoint or saved one is invalid, use the first available one
                        if (!isValidSaved) {
                            const firstId = availableEndpoints[0].id
                            setSelectedEndpoint(firstId)
                            localStorage.setItem("selectedEndpoint", firstId)
                        } else {
                            // If we have a valid saved endpoint, ensure state matches (it might be 'default' initially)
                            if (savedEndpoint) setSelectedEndpoint(savedEndpoint)
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch endpoints for initialization", e)
            }
        }

        initEndpoints()
    }, [])

    React.useEffect(() => {
        // Fetch models when endpoint changes
        if (!selectedEndpoint) return

        const fetchModels = async () => {
            setModels([]) // Clear models while loading
            setSelectedModel("") // Reset selection
            try {
                const res = await fetch(`/api/models?endpoint=${selectedEndpoint}`)
                if (res.ok) {
                    const data = await res.json()
                    const modelList = data.data || (Array.isArray(data) ? data : [])
                    const defaultModel = data.defaultModel

                    if (Array.isArray(modelList)) {
                        setModels(modelList)

                        // Check local storage for saved model (per endpoint)
                        const savedModel = localStorage.getItem(`selectedModel-${selectedEndpoint}`)
                        const foundSaved = modelList.find((m: { id: string }) => m.id === savedModel)

                        if (foundSaved) {
                            setSelectedModel(foundSaved.id)
                        } else {
                            // Priority: Configured Default -> first available
                            let preferred = null;
                            if (defaultModel) {
                                preferred = modelList.find((m: { id: string }) => m.id.includes(defaultModel));
                            }

                            if (!preferred) {
                                preferred = modelList[0]
                            }

                            if (preferred) {
                                setSelectedModel(preferred.id)
                            }
                        }

                        // Initialize Transcription and Visual models similarly
                        const savedTransModel = localStorage.getItem(`selectedTranscriptionModel-${selectedEndpoint}`)
                        const foundSavedTrans = modelList.find((m: { id: string }) => m.id === savedTransModel)
                        if (foundSavedTrans) {
                            setSelectedTranscriptionModel(foundSavedTrans.id)
                        } else {
                            // Default to same as selectedModel logic or logic
                             setSelectedTranscriptionModel(foundSaved ? foundSaved.id : (defaultModel ? modelList.find((m: {id: string}) => m.id.includes(defaultModel))?.id || modelList[0]?.id : modelList[0]?.id))
                        }

                        const savedVisualModel = localStorage.getItem(`selectedVisualModel-${selectedEndpoint}`)
                        const foundSavedVisual = modelList.find((m: { id: string }) => m.id === savedVisualModel)
                        if (foundSavedVisual) {
                            setSelectedVisualModel(foundSavedVisual.id)
                        } else {
                             setSelectedVisualModel(foundSaved ? foundSaved.id : (defaultModel ? modelList.find((m: {id: string}) => m.id.includes(defaultModel))?.id || modelList[0]?.id : modelList[0]?.id))
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch models", e)
            }
        }
        fetchModels()
    }, [selectedEndpoint])

    const handleModelChange = (value: string) => {
        setSelectedModel(value)
        localStorage.setItem(`selectedModel-${selectedEndpoint}`, value)
    }

    const handleTranscriptionModelChange = (value: string) => {
        setSelectedTranscriptionModel(value)
        localStorage.setItem(`selectedTranscriptionModel-${selectedEndpoint}`, value)
    }

    const handleVisualModelChange = (value: string) => {
        setSelectedVisualModel(value)
        localStorage.setItem(`selectedVisualModel-${selectedEndpoint}`, value)
    }

    const toggleFastMode = () => {
        const newValue = !isFastMode
        setIsFastMode(newValue)
        localStorage.setItem("fastMode", String(newValue))
    }

    const handleEndpointChange = (value: string) => {
        setSelectedEndpoint(value)
        localStorage.setItem("selectedEndpoint", value)
    }

    const handleLanguageChange = (value: string) => {
        setTargetLanguage(value)
        localStorage.setItem("targetLanguage", value)

        setLanguageHistory(prev => {
            // Add new language to start, remove duplicates, keep max 10
            const newHistory = [value, ...prev.filter(l => l !== value)].slice(0, 10)
            localStorage.setItem("languageHistory", JSON.stringify(newHistory))
            return newHistory
        })
    }

    const handleTranslate = React.useCallback(async (force: boolean = false, overrideText?: string) => {
        if (isLoading) return
        const textToUse = overrideText !== undefined ? overrideText : inputText
        if (!textToUse.trim() || !selectedModel) return

        const currentParams = {
            mode: 'translator' as AppMode,
            text: textToUse,
            targetLanguage,
            model: selectedModel,
            previousLanguage,
            endpoint: selectedEndpoint,
            isFastMode
        }

        // Avoid re-translating if parameters haven't changed since last success
        const lastParams = lastTranslatedParamsRef.current.translator
        if (!force && mode === 'translator' && lastParams &&
            lastParams.text === currentParams.text &&
            lastParams.targetLanguage === currentParams.targetLanguage &&
            lastParams.model === currentParams.model &&
            lastParams.previousLanguage === currentParams.previousLanguage &&
            lastParams.endpoint === currentParams.endpoint &&
            lastParams.isFastMode === currentParams.isFastMode
        ) {
            return
        }

        setIsLoading(true)
        setIsPronouncing(false)
        setContents(prev => ({
            ...prev,
            translator: { ...prev.translator, output: "", tokens: [] }
        }))

        try {
            // Step 1: Request translation ONLY (skip tokens)
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(currentParams)
            })
            const data = await res.json()
            let translatedText = "";

            if (data.translatedText) {
                translatedText = data.translatedText;
                setContents(prev => ({
                    ...prev,
                    translator: {
                        ...prev.translator,
                        output: translatedText,
                        tokens: []
                    }
                }))
                // Update cache on success
                lastTranslatedParamsRef.current.translator = currentParams
            } else if (data.error) {
                setContents(prev => ({
                    ...prev,
                    translator: { ...prev.translator, output: `Error: ${data.error}` }
                }))
                setIsLoading(false)
                return;
            }

            // Step 2: Request pronunciation tokens (if input < 300 chars)
            // Default only for Chinese
            const isChinese = targetLanguage.includes("Chinese");
            if (textToUse.length < 300 && translatedText && isChinese) {
                // Determine if we should show loading for tokens or just let them appear
                // We'll set isLoading to false so the user can see the text immediately.
                // The tokens will pop in when ready.
                setIsLoading(false)
                setIsPronouncing(true)

                try {
                    const resTokens = await fetch("/api/pronounce", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text: translatedText,
                            language: targetLanguage,
                            previousLanguage,
                            model: selectedModel,
                            endpoint: selectedEndpoint,
                            isFastMode
                        })
                    })
                    const dataTokens = await resTokens.json()

                    if (dataTokens.tokens && Array.isArray(dataTokens.tokens)) {
                         setContents(prev => {
                             // Only update if the output text hasn't changed in the meantime (race condition check)
                             if (prev.translator.output === translatedText) {
                                 // Cache the tokens
                                 if (lastTranslatedParamsRef.current.translator) {
                                     lastTranslatedParamsRef.current.translator.cachedTokens = dataTokens.tokens;
                                 }
                                 return {
                                     ...prev,
                                     translator: {
                                         ...prev.translator,
                                         tokens: dataTokens.tokens
                                     }
                                 }
                             }
                             return prev;
                         })
                    }
                } catch (e) {
                    console.error("Failed to fetch tokens", e);
                } finally {
                    setIsPronouncing(false)
                }
            } else {
                setIsLoading(false)
                setIsPronouncing(false)
            }

        } catch {
            setContents(prev => ({
                ...prev,
                translator: { ...prev.translator, output: "Error: Failed to connect to server." }
            }))
            setIsLoading(false)
        }
    }, [inputText, targetLanguage, selectedModel, previousLanguage, mode, selectedEndpoint, isFastMode, isLoading])

    const handlePolish = React.useCallback(async (force: boolean = false) => {
        if (isLoading) return
        if (!inputText.trim() || !selectedModel) return

        const currentParams = {
            mode: 'polisher' as AppMode,
            text: inputText,
            model: selectedModel,
            endpoint: selectedEndpoint,
            isFastMode
        }

        const lastParams = lastTranslatedParamsRef.current.polisher
        if (!force && mode === 'polisher' && lastParams &&
            lastParams.text === currentParams.text &&
            lastParams.model === currentParams.model &&
            (lastParams as { endpoint?: string }).endpoint === currentParams.endpoint &&
            (lastParams as { isFastMode?: boolean }).isFastMode === currentParams.isFastMode
        ) {
            return
        }

        setIsLoading(true)
        setContents(prev => ({
            ...prev,
            polisher: { ...prev.polisher, output: "", tokens: [] }
        }))

        try {
            const res = await fetch("/api/polish", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(currentParams)
            })
            const data = await res.json()
            if (data.polishedText) {
                setContents(prev => ({
                    ...prev,
                    polisher: { ...prev.polisher, output: data.polishedText }
                }))
                lastTranslatedParamsRef.current.polisher = { ...currentParams }
            } else if (data.error) {
                setContents(prev => ({
                    ...prev,
                    polisher: { ...prev.polisher, output: `Error: ${data.error}` }
                }))
            }
        } catch {
            setContents(prev => ({
                ...prev,
                polisher: { ...prev.polisher, output: "Error: Failed to connect to server." }
            }))
        } finally {
            setIsLoading(false)
        }
    }, [inputText, selectedModel, mode, selectedEndpoint, isFastMode, isLoading])

    // Unified handler
    const handleAction = React.useCallback((force: boolean = false, overrideText?: string) => {
        if (mode === 'translator') {
            handleTranslate(force, overrideText)
        } else {
            handlePolish(force)
        }
    }, [mode, handleTranslate, handlePolish])

    // Trigger translation when target language changes
    const prevTargetLanguage = React.useRef(targetLanguage)
    React.useEffect(() => {
        if (prevTargetLanguage.current !== targetLanguage) {
            if (mode === 'translator' && inputText.trim()) {
                handleAction()
            }
            prevTargetLanguage.current = targetLanguage
        }
    }, [targetLanguage, mode, inputText, handleAction])

    const handleManualPronounce = React.useCallback(async () => {
        if (isLoading || isPronouncing || !translatedText) return;

        // Toggle off if already showing tokens
        if (tokens.length > 0) {
            setContents(prev => ({
                ...prev,
                [mode]: {
                    ...prev[mode],
                    tokens: []
                }
            }));
            return;
        }

        // Check if we have cached tokens for the current output state
        if (lastTranslatedParamsRef.current[mode] &&
            lastTranslatedParamsRef.current[mode]?.cachedTokens &&
            lastTranslatedParamsRef.current[mode]?.cachedTokens.length > 0) {
             // We need to be careful: lastTranslatedParamsRef stores INPUT params.
             // But if specific input params lead to specific output, and the current output matches, it's safer.
             // Since we don't store output in ref, we assume if we are here, and user hasn't
             // changed anything that would clear the output, the cache is valid for the current session.
             // Actually, if input text changed but output didn't update (user just typing), the ref might not match input text.
             // But the tokens are tied to the *last successful translation*.
             // So if contents[mode].output is present, it *is* the result of the last successful translation.
             setContents(prev => ({
                 ...prev,
                 [mode]: {
                     ...prev[mode],
                     tokens: lastTranslatedParamsRef.current[mode]!.cachedTokens!
                 }
             }));
             return;
        }

        setIsPronouncing(true);
        try {
            const resTokens = await fetch("/api/pronounce", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: translatedText,
                    language: targetLanguage,
                    previousLanguage,
                    model: selectedModel,
                    endpoint: selectedEndpoint,
                    isFastMode
                })
            });
            const dataTokens = await resTokens.json();

            if (dataTokens.tokens && Array.isArray(dataTokens.tokens)) {
                setContents(prev => {
                    // Only update if the output text hasn't changed in the meantime
                    if (prev[mode].output === translatedText) {
                         // Cache result
                         if (lastTranslatedParamsRef.current[mode]) {
                             lastTranslatedParamsRef.current[mode]!.cachedTokens = dataTokens.tokens;
                         }
                        return {
                            ...prev,
                            [mode]: {
                                ...prev[mode],
                                tokens: dataTokens.tokens
                            }
                        };
                    }
                    return prev;
                });
            }
        } catch (e) {
            console.error("Failed to fetch tokens manually", e);
        } finally {
            setIsPronouncing(false);
        }
    }, [translatedText, targetLanguage, previousLanguage, selectedModel, selectedEndpoint, isFastMode, isLoading, isPronouncing, mode, tokens]);

    const handleInputPronounce = React.useCallback(async () => {
        if (isLoading || isPronouncing || !inputText.trim()) return;

        // Set output to input text immediately
        setContents(prev => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                output: inputText,
                tokens: []
            }
        }));

        setIsPronouncing(true);
        try {
            const resTokens = await fetch("/api/pronounce", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: inputText,
                    language: "Auto-detect", // Request auto-detection
                    model: selectedModel,
                    endpoint: selectedEndpoint,
                    isFastMode
                })
            });
            const dataTokens = await resTokens.json();

            if (dataTokens.tokens && Array.isArray(dataTokens.tokens)) {
                setContents(prev => {
                    // Only update if the output text matches our input text (user hasn't translated something else in between)
                    if (prev[mode].output === inputText) {
                        return {
                            ...prev,
                            [mode]: {
                                ...prev[mode],
                                tokens: dataTokens.tokens
                            }
                        };
                    }
                    return prev;
                });
            }
        } catch (e) {
            console.error("Failed to fetch input tokens", e);
        } finally {
            setIsPronouncing(false);
        }
    }, [inputText, mode, selectedModel, selectedEndpoint, isFastMode, isLoading, isPronouncing]);

    const copyToClipboard = () => {
        if (!translatedText) return
        navigator.clipboard.writeText(translatedText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    if (!mounted) return null

    return (
        <div className="h-dvh w-full bg-background flex flex-col items-center justify-start md:justify-center p-1 pt-4 pb-4 md:p-8 overflow-y-auto overscroll-none">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
                className="w-full max-w-4xl space-y-4 md:space-y-6"
            >
                {/* Mode Switch & Settings */}
                <div className="flex justify-center items-center relative">
                    {/* Theme Switcher (Desktop) */}
                    <div className="hidden md:flex w-auto justify-start md:absolute md:left-0">
                        <div className="bg-muted/50 p-0.5 rounded-lg flex gap-0.5 relative">
                            {(['system', 'light', 'dark'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={cn(
                                        "relative p-1.5 rounded-md transition-colors z-10 cursor-pointer flex items-center justify-center",
                                        theme === t ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                                    )}
                                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                                >
                                    {theme === t && (
                                        <motion.div
                                            layoutId="active-theme"
                                            className="absolute inset-0 bg-background shadow-sm rounded-md -z-10"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    {t === 'system' && <Monitor className="w-4 h-4" />}
                                    {t === 'light' && <Sun className="w-4 h-4" />}
                                    {t === 'dark' && <Moon className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-muted p-1 rounded-lg flex gap-1 relative shadow-sm">
                        {(['translator', 'polisher'] as AppMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    "relative px-3 py-1 md:px-6 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 md:gap-2",
                                    mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                                )}
                            >
                                {mode === m && (
                                    <motion.div
                                        layoutId="active-mode"
                                        className="absolute inset-0 bg-background shadow-sm rounded-md -z-10"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                {m === 'translator' ? <LanguagesIcon className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                <span>{m.charAt(0).toUpperCase() + m.slice(1)}</span>
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex w-auto justify-end md:absolute md:right-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings className="w-6 h-6"/>
                        </Button>
                    </div>
                </div>

                <Card className="w-full shadow-md md:shadow-lg border-muted/40 overflow-hidden">

                    <CardContent className="grid gap-3 md:gap-6 md:grid-cols-2 p-4 md:p-6 pt-3 relative">
                         {/* Animated overlay for loading state if desired, or just opacity on content */}

                        <div className="space-y-2 flex flex-col h-full">
                            <div className="h-8 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <label
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
                                        {mode === 'translator' ? 'Input (Auto-detect)' : 'Input (Draft)'}
                                    </label>
                                    <div className="flex flex-row-reverse items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                            onClick={handlePasteButton}
                                            disabled={isExtracting || isLoading}
                                            title="Paste from clipboard"
                                        >
                                            <ClipboardPaste className="h-5 w-5" />
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isExtracting || isLoading}
                                            title="Upload image"
                                        >
                                            {isExtracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-8 w-8 transition-colors cursor-pointer",
                                                isRecording ? "text-red-500 hover:text-red-600 animate-pulse" : "text-muted-foreground hover:text-foreground"
                                            )}
                                            onClick={handleMicClick}
                                            disabled={isExtracting || isLoading}
                                            title={isRecording ? "Stop recording" : "Record audio"}
                                        >
                                            <Mic className={cn("h-5 w-5", isRecording && "fill-current")} />
                                        </Button>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                    onClick={handleInputPronounce}
                                    disabled={!inputText.trim() || isLoading || isPronouncing}
                                    title="Show pronunciation for input"
                                >
                                    <Captions className="h-5 w-5" />
                                </Button>
                            </div>
                            {isExtracting ? (
                                <div className="min-h-55 md:min-h-90 w-full rounded-md border border-input bg-muted/20 shadow-sm flex-1 p-3">
                                    <LoadingAnimation />
                                </div>
                            ) : (
                                <Textarea
                                    disabled={isExtracting}
                                    placeholder={mode === 'translator' ? "Type text to translate..." : "Type text to polish..."}
                                    className="min-h-55 md:min-h-90 resize-none text-base bg-background/50 focus:bg-background transition-colors flex-1"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onPaste={handlePaste}
                                    onBlur={(e) => {
                                        // Only target empty areas/background clicks
                                        // If interacting with other elements (buttons, inputs), skip auto-action
                                        if (e.relatedTarget) return;

                                        if (mode === 'translator' && inputText.trim()) {
                                            handleAction()
                                        }
                                    }}
                                />
                            )}
                        </div>

                        <div className="space-y-2 relative flex flex-col h-full">
                            <div className="h-8 flex items-center justify-between gap-2">
                                {mode === 'translator' ? (
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Select value={targetLanguage} onValueChange={handleLanguageChange} disabled={isLoading}>
                                            <SelectTrigger className="h-8 w-fit min-w-35 px-2 bg-muted/20 hover:bg-muted/40 border-transparent focus:ring-0 shadow-none text-sm gap-2 cursor-pointer shrink-0 disabled:opacity-100">
                                                <span className="text-muted-foreground whitespace-nowrap">To:</span>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LANGUAGES.map(lang => (
                                                    <SelectItem key={lang} value={lang} className="cursor-pointer">{lang}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {previousLanguage && (
                                            <div
                                                className={cn(
                                                    "flex items-center gap-1 text-xs font-normal text-muted-foreground/50 whitespace-nowrap overflow-hidden text-ellipsis transition-colors",
                                                    isLoading ? "opacity-100 cursor-default" : "hover:text-foreground/80 cursor-pointer"
                                                )}
                                                title={`Switch to fallback: ${previousLanguage}`}
                                                onClick={() => !isLoading && handleLanguageChange(previousLanguage)}
                                            >
                                                <CornerDownRight className="w-3 h-3" />
                                                <span>{previousLanguage}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground">
                                        Polished Version
                                    </label>
                                )}
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-opacity duration-200",
                                            translatedText ? "opacity-100" : "opacity-0 pointer-events-none",
                                            tokens.length > 0 && "text-foreground"
                                        )}
                                        onClick={handleManualPronounce}
                                        title={tokens.length > 0 ? "Hide pronunciation" : "Show pronunciation"}
                                        disabled={!translatedText || isLoading || isPronouncing}
                                    >
                                        {isPronouncing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Captions className={cn("h-5 w-5", tokens.length > 0 && "fill-current")}/>}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-opacity duration-200",
                                            translatedText ? "opacity-100" : "opacity-0 pointer-events-none"
                                        )}
                                        onClick={copyToClipboard}
                                        title="Copy to clipboard"
                                        disabled={!translatedText}
                                    >
                                        {isCopied ? <Check className="h-5 w-5 text-green-500"/> :
                                            <Copy className="h-5 w-5"/>}
                                    </Button>
                                </div>
                            </div>
                            <div className="relative flex-1 flex flex-col">
                                {/* Using a div to simulate Textarea appearance but support formatting */}
                                <div className={cn(
                                    "w-full rounded-md border border-input bg-muted/20 text-base shadow-sm min-h-55 max-h-55 md:min-h-90 md:max-h-90 flex-1 transition-colors duration-200 relative overflow-hidden",
                                    mode === 'polisher' ? "md:text-sm" : ""
                                )}>
                                    <div className="w-full h-full overflow-y-auto flex flex-wrap content-start gap-1 px-3 py-2">
                                        {isLoading ? (
                                            <LoadingAnimation />
                                        ) : (
                                            <>
                                            {!translatedText && (
                                                <span className="text-muted-foreground opacity-50">
                                                    {mode === 'translator' ? "Translation will appear here..." : "Polished version will appear here..."}
                                                </span>
                                            )}

                                            {tokens.length > 0 ? (
                                                tokens.map((token, i) => (
                                                    token.text === '\n' ? (
                                                        <div key={i} className="basis-full h-0" />
                                                    ) : (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, y: 5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.005 }}
                                                            className="flex flex-col items-center justify-end leading-snug"
                                                        >
                                                            {token.pronunciation && (
                                                                <span className="text-sm text-muted-foreground/80 select-none mb-0.5 px-0.5">
                                                                    {token.pronunciation}
                                                                </span>
                                                            )}
                                                            <span className="text-foreground">{token.text === " " ? "\u00A0" : token.text}</span>
                                                        </motion.div>
                                                    )
                                                ))
                                            ) : (
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="whitespace-pre-wrap w-full"
                                                >
                                                    {translatedText}
                                                </motion.span>
                                            )}

                                            </>
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {isPronouncing && (
                                            <motion.div
                                                initial={{opacity: 0, y: 5}}
                                                animate={{opacity: 1, y: 0}}
                                                exit={{opacity: 0, y: 5}}
                                                className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-background/90 backdrop-blur-sm rounded-full shadow-sm border border-border/50 z-20 cursor-default"
                                            >
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                                </span>
                                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Pronouncing</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center gap-3 p-4 md:p-8 pt-2 md:pt-2">
                        <Button
                            variant={isFastMode ? "default" : "outline"}
                            className={cn(
                                "h-10 w-10 md:h-11 md:w-11 min-w-10 md:min-w-11 p-0 font-semibold shadow-sm transition-all active:scale-95 cursor-pointer rounded-md shrink-0",
                                isFastMode ? "hover:shadow-md" : "text-muted-foreground hover:bg-muted/50 border-input hover:text-foreground"
                            )}
                            onClick={toggleFastMode}
                            title={isFastMode ? "Fast mode enabled (Minimum thinking level)" : "Fast mode disabled (Enable for faster results)"}
                        >
                            <Zap className={cn("w-5 h-5", isFastMode ? "fill-current" : "")} />
                        </Button>
                        <Button
                            className="w-full md:w-auto min-w-40 h-10 md:h-11 font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                            onClick={() => handleAction(true)}
                            disabled={isLoading || isExtracting || !inputText.trim() || !selectedModel}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                    {mode === 'translator' ? 'Translating...' : 'Polishing...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'translator' ? 'Translate' : 'Polish'} <ArrowRight className="ml-2 h-4 w-4"/>
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* Mobile Theme & Settings */}
                <div className="flex md:hidden justify-between items-center w-full px-1">
                    <div className="bg-muted/50 p-0.5 rounded-lg flex gap-0.5 relative">
                        {(['system', 'light', 'dark'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                className={cn(
                                    "relative p-1.5 rounded-md transition-colors z-10 cursor-pointer flex items-center justify-center",
                                    theme === t ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                                )}
                                title={t.charAt(0).toUpperCase() + t.slice(1)}
                            >
                                {theme === t && (
                                    <motion.div
                                        layoutId="active-theme-mobile"
                                        className="absolute inset-0 bg-background shadow-sm rounded-md -z-10"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                {t === 'system' && <Monitor className="w-4 h-4" />}
                                {t === 'light' && <Sun className="w-4 h-4" />}
                                {t === 'dark' && <Moon className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="w-6 h-6"/>
                    </Button>
                </div>
            </motion.div>

            <SettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                selectedEndpoint={selectedEndpoint}
                onEndpointChange={handleEndpointChange}
                models={models}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                selectedTranscriptionModel={selectedTranscriptionModel}
                onTranscriptionModelChange={handleTranscriptionModelChange}
                selectedVisualModel={selectedVisualModel}
                onVisualModelChange={handleVisualModelChange}
            />
        </div>
    )
}
