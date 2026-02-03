"use client";

import * as React from "react";
import {motion} from "framer-motion";
import {ArrowRight, Copy, Loader2, Check, Globe} from "lucide-react";

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

export default function TranslatorApp() {
    const [models, setModels] = React.useState<{ id: string }[]>([])
    const [selectedModel, setSelectedModel] = React.useState<string>("")
    const [targetLanguage, setTargetLanguage] = React.useState<string>(LANGUAGES[0])
    const [languageHistory, setLanguageHistory] = React.useState<string[]>([])

    const [inputText, setInputText] = React.useState<string>("")
    const [translatedText, setTranslatedText] = React.useState<string>("")
    const [tokens, setTokens] = React.useState<{ text: string; pronunciation: string }[]>([])
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isCopied, setIsCopied] = React.useState<boolean>(false)

    // Ref to track last successful translation parameters to prevent redundant requests
    const lastTranslatedParamsRef = React.useRef<{
        text: string;
        targetLanguage: string;
        model: string;
        previousLanguage?: string;
    } | null>(null)

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

    const handleTranslate = React.useCallback(async () => {
        if (!inputText.trim() || !selectedModel) return

        const currentParams = {
            text: inputText,
            targetLanguage,
            model: selectedModel,
            previousLanguage
        }

        // Avoid re-translating if parameters haven't changed since last success
        const lastParams = lastTranslatedParamsRef.current
        if (lastParams &&
            lastParams.text === currentParams.text &&
            lastParams.targetLanguage === currentParams.targetLanguage &&
            lastParams.model === currentParams.model &&
            lastParams.previousLanguage === currentParams.previousLanguage
        ) {
            return
        }

        setIsLoading(true)
        setTranslatedText("")
        setTokens([])

        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(currentParams)
            })
            const data = await res.json()
            if (data.translatedText) {
                setTranslatedText(data.translatedText)
                if (data.tokens && Array.isArray(data.tokens)) {
                    setTokens(data.tokens)
                }
                // Update cache on success
                lastTranslatedParamsRef.current = currentParams
            } else if (data.error) {
                setTranslatedText(`Error: ${data.error}`)
            }
        } catch {
            setTranslatedText("Error: Failed to connect to server.")
        } finally {
            setIsLoading(false)
        }
    }, [inputText, targetLanguage, selectedModel, languageHistory, previousLanguage])

    // Auto-translate debounce
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (inputText.trim()) {
                handleTranslate()
            }
        }, 2000)

        return () => clearTimeout(timer)
    }, [inputText, handleTranslate])

    const copyToClipboard = () => {
        if (!translatedText) return
        navigator.clipboard.writeText(translatedText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-3 md:p-8">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
                className="w-full max-w-4xl space-y-4 md:space-y-6"
            >

                <Card className="w-full shadow-md md:shadow-lg border-muted/40">
                    <CardHeader
                        className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between space-y-0 p-4 md:p-6 pb-2 md:pb-6">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Globe className="h-4 w-4 text-muted-foreground hidden md:block"/>
                            <span className="text-sm font-medium hidden md:inline">Model:</span>
                            <Select value={selectedModel} onValueChange={handleModelChange}>
                                <SelectTrigger className="w-full md:w-50 h-9 md:h-10 bg-background/50">
                                    <SelectValue placeholder="Select a model"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {models.length > 0 ? models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
                                    )) : <SelectItem value="loading" disabled>Loading models...</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-medium text-nowrap hidden md:inline">Translate to:</span>
                            <Select value={targetLanguage} onValueChange={handleLanguageChange}>
                                <SelectTrigger className="w-full md:w-45 h-9 md:h-10 bg-background/50">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map(lang => (
                                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:gap-6 md:grid-cols-2 p-4 md:p-6 pt-0">
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 hidden md:block">Input
                                (Auto-detect)</label>
                            <Textarea
                                placeholder="Type text to translate..."
                                className="min-h-[140px] md:min-h-50 resize-none text-base bg-background/50 focus:bg-background transition-colors"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <label
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 hidden md:block">
                                Output ({targetLanguage})
                                {previousLanguage && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                                        (fallback: {previousLanguage})
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                {/* Using a div to simulate Textarea appearance but support formatting */}
                                <div className={cn(
                                    "flex flex-wrap content-start gap-1 p-3 w-full rounded-md border border-input bg-muted/20 text-base shadow-sm min-h-[140px] md:min-h-50 overflow-y-auto",
                                )}>
                                    {!translatedText && (
                                        <span className="text-muted-foreground opacity-50">Translation will appear here...</span>
                                    )}

                                    {tokens.length > 0 ? (
                                        tokens.map((token, i) => (
                                            <div key={i} className="flex flex-col items-center justify-end leading-snug">
                                                {token.pronunciation && (
                                                    <span className="text-[10px] md:text-xs text-muted-foreground/80 select-none mb-0.5 px-0.5">
                                                        {token.pronunciation}
                                                    </span>
                                                )}
                                                <span className="text-foreground">{token.text === " " ? "\u00A0" : token.text}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <span>{translatedText}</span>
                                    )}
                                </div>

                                {translatedText && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-2 top-2 h-8 w-8 bg-background/50 hover:bg-background/80 z-10"
                                        onClick={copyToClipboard}
                                    >
                                        {isCopied ? <Check className="h-4 w-4 text-green-500"/> :
                                            <Copy className="h-4 w-4"/>}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center p-4 md:p-8 pt-2 md:pt-2">
                        <Button
                            className="w-full md:w-auto min-w-[160px] h-10 md:h-11 font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
                            onClick={handleTranslate}
                            disabled={isLoading || !inputText.trim() || !selectedModel}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                    Translating...
                                </>
                            ) : (
                                <>
                                    Translate <ArrowRight className="ml-2 h-4 w-4"/>
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    )
}
