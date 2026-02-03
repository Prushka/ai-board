import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Endpoint {
    id: string;
    name: string;
}

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedEndpoint: string;
    onEndpointChange: (id: string) => void;
}

export function SettingsDialog({ isOpen, onClose, selectedEndpoint, onEndpointChange }: SettingsDialogProps) {
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
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Endpoint</h3>
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
