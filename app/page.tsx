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


const LANGUAGES = [
    "English", "Chinese (Simplified)", "Russian",
    "Japanese", "Korean",
    "Turkish", "French",
    "Spanish", "German",
    "Italian", "Portuguese",
    "Chinese (Traditional)",
    "Arabic", "Hindi", "Dutch", "Polish", "Swedish",
    "Indonesian", "Vietnamese", "Thai"
]

export default function TranslatorApp() {
    const [models, setModels] = React.useState<{ id: string }[]>([])
    const [selectedModel, setSelectedModel] = React.useState<string>("")
    const [targetLanguage, setTargetLanguage] = React.useState<string>("Chinese (Simplified)")
    const [inputText, setInputText] = React.useState<string>("")
    const [translatedText, setTranslatedText] = React.useState<string>("")
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isCopied, setIsCopied] = React.useState<boolean>(false)

    React.useEffect(() => {
        // Fetch models on mount
        const fetchModels = async () => {
            try {
                const res = await fetch("/api/models")
                if (res.ok) {
                    const data = await res.json()
                    // Filter for chat models if possible, or just list all
                    // Usually OpenAI list returns lots of system models.
                    // For now, assume user knows which to pick or backend returns them.
                    // Or just standard display.
                    const modelList = data.data || data // OpenAI style usually { data: [...] }
                    if (Array.isArray(modelList)) {
                        setModels(modelList)
                        // Auto-select gpt-4o-mini or gpt-3.5-turbo if available, else first
                        const preferred = modelList.find((m: {
                            id: string
                        }) => m.id.includes("gpt-4o")) || modelList.find((m: {
                            id: string
                        }) => m.id.includes("gpt-3.5")) || modelList[0]
                        if (preferred) setSelectedModel(preferred.id)
                    }
                }
            } catch (e) {
                console.error("Failed to fetch models", e)
            }
        }
        fetchModels()
    }, [])

    const handleTranslate = React.useCallback(async () => {
        if (!inputText.trim() || !selectedModel) return

        setIsLoading(true)
        setTranslatedText("")
        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    text: inputText,
                    targetLanguage,
                    model: selectedModel
                })
            })
            const data = await res.json()
            if (data.translatedText) {
                setTranslatedText(data.translatedText)
            } else if (data.error) {
                setTranslatedText(`Error: ${data.error}`)
            }
        } catch {
            setTranslatedText("Error: Failed to connect to server.")
        } finally {
            setIsLoading(false)
        }
    }, [inputText, targetLanguage, selectedModel])

    // Auto-translate debounce
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (inputText.trim()) {
                handleTranslate()
            }
        }, 3000)

        return () => clearTimeout(timer)
    }, [inputText, handleTranslate])

    const copyToClipboard = () => {
        if (!translatedText) return
        navigator.clipboard.writeText(translatedText)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
                className="w-full max-w-4xl space-y-6"
            >

                <Card className="w-full shadow-lg border-muted/40">
                    <CardHeader
                        className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between space-y-0 pb-6">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Globe className="h-4 w-4 text-muted-foreground"/>
                            <span className="text-sm font-medium">Model:</span>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="w-full md:w-50">
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
                            <span className="text-sm font-medium text-nowrap">Translate to:</span>
                            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                <SelectTrigger className="w-full md:w-45">
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
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <label
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Input
                                (Auto-detect)</label>
                            <Textarea
                                placeholder="Type something to translate..."
                                className="min-h-50 resize-none text-base bg-background"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <label
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Output
                                ({targetLanguage})</label>
                            <div className="relative">
                                <Textarea
                                    readOnly
                                    placeholder="Translation will appear here..."
                                    className="min-h-50 resize-none bg-muted/20 text-base"
                                    value={translatedText}
                                />
                                {translatedText && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-2 top-2 h-8 w-8 bg-background/50 hover:bg-background/80"
                                        onClick={copyToClipboard}
                                    >
                                        {isCopied ? <Check className="h-4 w-4 text-green-500"/> :
                                            <Copy className="h-4 w-4"/>}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-8 pt-2">
                        <Button
                            size="lg"
                            className="w-full md:w-auto min-w-50 text-lg"
                            onClick={handleTranslate}
                            disabled={isLoading || !inputText.trim() || !selectedModel}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                                    Translating...
                                </>
                            ) : (
                                <>
                                    Translate <ArrowRight className="ml-2 h-5 w-5"/>
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    )
}
