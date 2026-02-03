"use client";

import * as React from "react";
import {motion, AnimatePresence} from "framer-motion";
import {ArrowRight, Copy, Loader2, Check, Globe, Languages as LanguagesIcon, Sparkles} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Card, CardContent, CardFooter, CardHeader} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    const [mode, setMode] = React.useState<AppMode>('translator')
    const [models, setModels] = React.useState<{ id: string }[]>([])
    const [selectedModel, setSelectedModel] = React.useState<string>("")
    const [targetLanguage, setTargetLanguage] = React.useState<string>(LANGUAGES[0])
    const [languageHistory, setLanguageHistory] = React.useState<string[]>([])

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
    const [isCopied, setIsCopied] = React.useState<boolean>(false)

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

    React.useEffect(() => {
        // Fetch models on mount
        const fetchModels = async () => {
            try {
                const res = await fetch("/api/models")
                if (res.ok) {
                    const data = await res.json()
                    const modelList = data.data || data
                    if (Array.isArray(modelList)) {
                        setModels(modelList)

                        // Check local storage for saved model
                        const savedModel = localStorage.getItem("selectedModel")
                        const foundSaved = modelList.find((m: { id: string }) => m.id === savedModel)

                        if (foundSaved) {
                            setSelectedModel(foundSaved.id)
                        } else {
                            // Auto-select gpt-4o-mini or gpt-3.5-turbo if available, else first
                            const preferred = modelList.find((m: {
                                id: string
                            }) => m.id.includes("gpt-4o")) || modelList.find((m: {
                                id: string
                            }) => m.id.includes("gpt-3.5")) || modelList[0]
                            if (preferred) {
                                setSelectedModel(preferred.id)
                                localStorage.setItem("selectedModel", preferred.id)
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch models", e)
            }
        }
        fetchModels()
    }, [])

    const handleModelChange = (value: string) => {
        setSelectedModel(value)
        localStorage.setItem("selectedModel", value)
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

    const handleTranslate = React.useCallback(async (force: boolean = false) => {
        if (!inputText.trim() || !selectedModel) return

        const currentParams = {
            mode: 'translator' as AppMode,
            text: inputText,
            targetLanguage,
            model: selectedModel,
            previousLanguage
        }

        // Avoid re-translating if parameters haven't changed since last success
        const lastParams = lastTranslatedParamsRef.current.translator
        if (!force && mode === 'translator' && lastParams &&
            lastParams.text === currentParams.text &&
            lastParams.targetLanguage === currentParams.targetLanguage &&
            lastParams.model === currentParams.model &&
            lastParams.previousLanguage === currentParams.previousLanguage
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
    }, [inputText, targetLanguage, selectedModel, languageHistory, previousLanguage, mode])

    const handlePolish = React.useCallback(async (force: boolean = false) => {
        if (!inputText.trim() || !selectedModel) return

        const currentParams = {
            mode: 'polisher' as AppMode,
            text: inputText,
            model: selectedModel,
        }

        const lastParams = lastTranslatedParamsRef.current.polisher
        if (!force && mode === 'polisher' && lastParams &&
            lastParams.text === currentParams.text &&
            lastParams.model === currentParams.model
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
    }, [inputText, selectedModel, mode])

    // Unified handler
    const handleAction = React.useCallback((force: boolean = false) => {
        if (mode === 'translator') {
            handleTranslate(force)
        } else {
            handlePolish(force)
        }
    }, [mode, handleTranslate, handlePolish])

    // Auto-translate debounce
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (inputText.trim()) {
                handleAction()
            }
        }, 2000)

        return () => clearTimeout(timer)
    }, [inputText, handleAction])

    const copyToClipboard = () => {
        if (!translatedText) return
        navigator.clipboard.writeText(translatedText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-start md:justify-center p-3 pt-10 md:p-8">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
                className="w-full max-w-4xl space-y-4 md:space-y-6"
            >
                {/* Mode Switch */}
                <div className="flex justify-center">
                    <div className="bg-muted p-1 rounded-lg flex gap-1 relative">
                        {(['translator', 'polisher'] as AppMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    "relative px-6 py-1.5 text-sm font-medium rounded-md transition-colors z-10 cursor-pointer flex items-center gap-2",
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
                                {m === 'translator' ? <LanguagesIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <Card className="w-full shadow-md md:shadow-lg border-muted/40 overflow-hidden">
                    <CardHeader
                        className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between space-y-0 p-4 md:p-6 pb-2 md:pb-6 bg-muted/10">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0"/>
                            <span className="text-sm font-medium hidden md:inline">Model:</span>
                            <Select value={selectedModel} onValueChange={handleModelChange}>
                                <SelectTrigger className="w-full md:w-50 h-9 md:h-10 bg-background/50 cursor-pointer">
                                    <SelectValue placeholder="Select a model"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {models.length > 0 ? models.map((model) => (
                                        <SelectItem key={model.id} value={model.id} className="cursor-pointer">{model.id}</SelectItem>
                                    )) : <SelectItem value="loading" disabled>Loading models...</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {mode === 'translator' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center gap-2 w-full md:w-auto"
                                >
                                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 md:hidden"/>
                                    <span className="text-sm font-medium text-nowrap hidden md:inline">Translate to:</span>
                                    <Select value={targetLanguage} onValueChange={handleLanguageChange}>
                                        <SelectTrigger className="w-full md:w-45 h-9 md:h-10 bg-background/50 cursor-pointer">
                                            <SelectValue/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LANGUAGES.map(lang => (
                                                <SelectItem key={lang} value={lang} className="cursor-pointer">{lang}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardHeader>

                    <CardContent className="grid gap-3 md:gap-6 md:grid-cols-2 p-4 md:p-6 pt-3 relative">
                         {/* Animated overlay for loading state if desired, or just opacity on content */}

                        <div className="space-y-2 flex flex-col h-full">
                            <div className="h-5 flex items-center">
                                <label
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
                                    {mode === 'translator' ? 'Input (Auto-detect)' : 'Input (Draft)'}
                                </label>
                            </div>
                            <Textarea
                                placeholder={mode === 'translator' ? "Type text to translate..." : "Type text to polish..."}
                                className="min-h-55 md:min-h-90 resize-none text-base bg-background/50 focus:bg-background transition-colors flex-1"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 relative flex flex-col h-full">
                            <div className="min-h-5 flex items-center justify-between gap-2">
                                <label
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground">
                                    {mode === 'translator' ? `Output (${targetLanguage})` : 'Polished Version'}
                                    {mode === 'translator' && previousLanguage && (
                                        <span className="ml-2 text-xs font-normal text-muted-foreground/50">
                                            (fallback: {previousLanguage})
                                        </span>
                                    )}
                                </label>
                                {translatedText && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                                        onClick={copyToClipboard}
                                        title="Copy to clipboard"
                                    >
                                        {isCopied ? <Check className="h-4 w-4 text-green-500"/> :
                                            <Copy className="h-4 w-4"/>}
                                    </Button>
                                )}
                            </div>
                            <div className="relative flex-1 flex flex-col">
                                {/* Using a div to simulate Textarea appearance but support formatting */}
                                <div className={cn(
                                    "flex flex-wrap content-start gap-1 px-3 py-2 w-full rounded-md border border-input bg-muted/20 text-base shadow-sm min-h-55 md:min-h-90 overflow-y-auto flex-1 transition-colors duration-200",
                                    isLoading ? "opacity-70 bg-muted/30" : ""
                                )}>
                                    {!translatedText && (
                                        <span className="text-muted-foreground opacity-50">
                                            {mode === 'translator' ? "Translation will appear here..." : "Polished version will appear here..."}
                                        </span>
                                    )}

                                    {tokens.length > 0 ? (
                                        tokens.map((token, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.005 }}
                                                className="flex flex-col items-center justify-end leading-snug"
                                            >
                                                {token.pronunciation && (
                                                    <span className="text-[10px] md:text-xs text-muted-foreground/80 select-none mb-0.5 px-0.5">
                                                        {token.pronunciation}
                                                    </span>
                                                )}
                                                <span className="text-foreground">{token.text === " " ? "\u00A0" : token.text}</span>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            {translatedText}
                                        </motion.span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center p-4 md:p-8 pt-2 md:pt-2">
                        <Button
                            className="w-full md:w-auto min-w-[160px] h-10 md:h-11 font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                            onClick={() => handleAction(true)}
                            disabled={isLoading || !inputText.trim() || !selectedModel}
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
            </motion.div>
        </div>
    )
}
