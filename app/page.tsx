"use client";

import * as React from "react";
import {motion} from "framer-motion";
import {ArrowRight, Copy, Loader2, Check, Languages as LanguagesIcon, Sparkles, Settings, Sun, Moon, Monitor, Upload, Camera, CornerDownRight, Zap} from "lucide-react";
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

    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const cameraInputRef = React.useRef<HTMLInputElement>(null)

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
                            model: selectedModel
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

    // Ref to track last successful translation parameters to prevent redundant requests
    const lastTranslatedParamsRef = React.useRef<{
        translator: {
            text: string;
            targetLanguage: string;
            model: string;
            previousLanguage?: string;
        } | null;
        polisher: {
            text: string;
            model: string;
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
            (lastParams as { endpoint?: string }).endpoint === currentParams.endpoint &&
            (lastParams as { isFastMode?: boolean }).isFastMode === currentParams.isFastMode
        ) {
            return
        }

        setIsLoading(true)
        setContents(prev => ({
            ...prev,
            translator: { ...prev.translator, output: "", tokens: [] }
        }))

        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(currentParams)
            })
            const data = await res.json()
            if (data.translatedText) {
                setContents(prev => ({
                    ...prev,
                    translator: {
                        ...prev.translator,
                        output: data.translatedText,
                        tokens: (data.tokens && Array.isArray(data.tokens)) ? data.tokens : []
                    }
                }))
                // Update cache on success
                lastTranslatedParamsRef.current.translator = currentParams
            } else if (data.error) {
                setContents(prev => ({
                    ...prev,
                    translator: { ...prev.translator, output: `Error: ${data.error}` }
                }))
            }
        } catch {
            setContents(prev => ({
                ...prev,
                translator: { ...prev.translator, output: "Error: Failed to connect to server." }
            }))
        } finally {
            setIsLoading(false)
        }
    }, [inputText, targetLanguage, selectedModel, previousLanguage, mode, selectedEndpoint, isFastMode])

    const handlePolish = React.useCallback(async (force: boolean = false) => {
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
    }, [inputText, selectedModel, mode, selectedEndpoint, isFastMode])

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
                                <label
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
                                    {mode === 'translator' ? 'Input (Auto-detect)' : 'Input (Draft)'}
                                </label>
                                <div className="flex items-center gap-1">
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
                                    <input
                                        type="file"
                                        ref={cameraInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileUpload}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={isExtracting || isLoading}
                                        title="Take photo"
                                    >
                                        <Camera className="h-5 w-5" />
                                    </Button>
                                </div>
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
                            <div className="relative flex-1 flex flex-col">
                                {/* Using a div to simulate Textarea appearance but support formatting */}
                                <div className={cn(
                                    "flex flex-wrap content-start gap-1 px-3 py-2 w-full rounded-md border border-input bg-muted/20 text-base shadow-sm min-h-55 max-h-55 md:min-h-90 md:max-h-90 overflow-y-auto flex-1 transition-colors duration-200",
                                    mode === 'polisher' ? "md:text-sm" : ""
                                )}>
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
            />
        </div>
    )
}
