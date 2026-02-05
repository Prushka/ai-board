import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface Endpoint {
    id: string;
    name: string;
}

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedEndpoint: string;
    onEndpointChange: (id: string) => void;
    models: { id: string }[];
    selectedModel: string;
    onModelChange: (id: string) => void;
    selectedTranscriptionModel: string;
    onTranscriptionModelChange: (id: string) => void;
    selectedVisualModel: string;
    onVisualModelChange: (id: string) => void;
}

const ModelSelector = ({
    label,
    value,
    onChange,
    models,
    placeholder,
    isLoading
}: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    models: { id: string }[],
    placeholder: string,
    isLoading: boolean
}) => {
    const [open, setOpen] = React.useState(false);

    return (
        <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between bg-background/50 cursor-pointer font-normal"
                    >
                        {value
                            ? models.find((model) => model.id === value)?.id || value
                            : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                        <CommandInput placeholder="Search model..."/>
                        <CommandList>
                            <CommandEmpty>No model found.</CommandEmpty>
                            <CommandGroup>
                                {models.map((model) => (
                                    <CommandItem
                                        key={model.id}
                                        value={model.id}
                                        onSelect={() => {
                                            onChange(model.id);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === model.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {model.id}
                                    </CommandItem>
                                ))}
                                {models.length === 0 && (
                                    <div className="p-2 text-sm text-center text-muted-foreground">
                                        {isLoading ? "Loading models..." : "No models available"}
                                    </div>
                                )}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export function SettingsDialog({
   isOpen,
   onClose,
   selectedEndpoint,
   onEndpointChange,
   models,
   selectedModel,
   onModelChange,
   selectedTranscriptionModel,
   onTranscriptionModelChange,
   selectedVisualModel,
   onVisualModelChange
}: SettingsDialogProps) {
    const [endpoints, setEndpoints] = React.useState<Endpoint[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setError(null);
            fetch("/api/endpoints")
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch endpoints");
                    return res.json();
                })
                .then(data => {
                    setEndpoints(data);
                })
                .catch(e => {
                    console.error(e);
                    setError("Failed to load endpoints");
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background rounded-lg shadow-lg border border-border z-50 overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-4 pb-0">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                Settings
                            </h2>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 cursor-pointer">
                                <X className="w-4 h-4"/>
                            </Button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="space-y-3">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Provider</h3>
                                {isLoading ? (
                                    <div className="text-sm text-center py-4 text-muted-foreground">Loading endpoints...</div>
                                ) : error ? (
                                    <div className="text-sm text-center py-4 text-destructive">{error}</div>
                                ) : (
                                    <div className="space-y-2">
                                        {endpoints.map(ep => (
                                            <div
                                                key={ep.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200",
                                                    selectedEndpoint === ep.id
                                                        ? "border-primary/50 bg-primary/5 shadow-sm"
                                                        : "border-transparent hover:bg-muted/50"
                                                )}
                                                onClick={() => onEndpointChange(ep.id)}
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-sm">{ep.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono opacity-70">ID: {ep.id}</span>
                                                </div>
                                                {selectedEndpoint === ep.id && (
                                                    <motion.div
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                    >
                                                        <Check className="w-4 h-4 text-primary"/>
                                                    </motion.div>
                                                )}
                                            </div>
                                        ))}
                                        {endpoints.length === 0 && (
                                            <div className="text-sm text-muted-foreground">No endpoints configured.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-border/50">
                                <ModelSelector
                                    label="Translator Model"
                                    value={selectedModel}
                                    onChange={onModelChange}
                                    models={models}
                                    placeholder="Select a translator model..."
                                    isLoading={isLoading}
                                />
                                <ModelSelector
                                    label="Transcription Model"
                                    value={selectedTranscriptionModel}
                                    onChange={onTranscriptionModelChange}
                                    models={models}
                                    placeholder="Select a transcription model..."
                                    isLoading={isLoading}
                                />
                                <ModelSelector
                                    label="Visual Model"
                                    value={selectedVisualModel}
                                    onChange={onVisualModelChange}
                                    models={models}
                                    placeholder="Select a visual model..."
                                    isLoading={isLoading}
                                />
                            </div>
                        </div>

                        <div className="p-4 pt-2 flex justify-end">
                            <Button onClick={onClose} variant="outline" className="min-w-20 cursor-pointer">Done</Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
