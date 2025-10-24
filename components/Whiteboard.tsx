import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PencilIcon, EraserIcon, TrashIcon, DownloadIcon, UndoIcon, RedoIcon } from './icons';

export const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#FFFFFF');
    const [lineWidth, setLineWidth] = useState(5);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const setCanvasDimensions = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (canvas && container) {
            const { width, height } = container.getBoundingClientRect();
            // Save current drawing to redraw after resize
            const currentDrawing = canvas.toDataURL();

            canvas.width = width;
            canvas.height = height;
            
            // Redraw
            const img = new Image();
            img.src = currentDrawing;
            img.onload = () => {
                 contextRef.current?.drawImage(img, 0, 0);
            }
        }
    }, []);

    const redrawCanvas = useCallback((dataUrl: string) => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (canvas && context) {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0);
            };
        }
    }, []);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            contextRef.current = canvas.getContext('2d');
        }

        const handleResize = () => {
            const currentData = history[historyIndex];
            setCanvasDimensions();
            if (currentData) {
                redrawCanvas(currentData);
            }
        };

        setCanvasDimensions();

        if (history.length === 0) {
            const savedDrawing = localStorage.getItem('whiteboard_drawing');
            if (savedDrawing) {
                setHistory([savedDrawing]);
                setHistoryIndex(0);
            } else if(canvas) {
                const blankState = canvas.toDataURL('image/png');
                setHistory([blankState]);
                setHistoryIndex(0);
            }
        }
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCanvasDimensions]);

     useEffect(() => {
        const currentData = history[historyIndex];
        if (currentData) {
            redrawCanvas(currentData);
        }
     }, [history, historyIndex, redrawCanvas]);

    useEffect(() => {
        const context = contextRef.current;
        if (context) {
            context.strokeStyle = color;
            context.lineWidth = lineWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.globalCompositeOperation = tool === 'pen' ? 'source-over' : 'destination-out';
        }
    }, [color, lineWidth, tool]);

    const getCoords = (event: MouseEvent | TouchEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        if (event instanceof MouseEvent) {
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        } else if (event.touches && event.touches.length > 0) {
            return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
        }
        return { x: 0, y: 0 };
    }

    const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
        const context = contextRef.current;
        if (!context) return;
        const { x, y } = getCoords(event.nativeEvent);
        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);
    }, []);

    const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const context = contextRef.current;
        if (!context) return;
        const { x, y } = getCoords(event.nativeEvent);
        context.lineTo(x, y);
        context.stroke();
    }, [isDrawing]);

    const finishDrawing = useCallback(() => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!context || !canvas) return;

        context.closePath();
        setIsDrawing(false);
        
        const newDrawing = canvas.toDataURL('image/png');
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newDrawing);
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        localStorage.setItem('whiteboard_drawing', newDrawing);
    }, [isDrawing, history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (canvas && context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            const blankState = canvas.toDataURL('image/png');
            setHistory([blankState]);
            setHistoryIndex(0);
            localStorage.removeItem('whiteboard_drawing');
        }
    };

    const downloadImage = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'whiteboard-drawing.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    };

    const ToolButton: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean; }> = 
    ({ active = false, onClick, title, children, disabled = false }) => (
        <button 
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`p-2 rounded-md transition-colors ${
                active ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500'
            } disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            <header className="flex items-center justify-between flex-wrap gap-4 p-3 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">Whiteboard</h1>
                <div className="flex items-center gap-3">
                    <ToolButton title="Undo" onClick={handleUndo} disabled={historyIndex <= 0}>
                        <UndoIcon />
                    </ToolButton>
                     <ToolButton title="Redo" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                        <RedoIcon />
                    </ToolButton>
                    <div className="w-px h-6 bg-gray-500 mx-1"></div>
                    <ToolButton title="Pen" active={tool === 'pen'} onClick={() => setTool('pen')}>
                        <PencilIcon className="w-5 h-5" />
                    </ToolButton>
                    <ToolButton title="Eraser" active={tool === 'eraser'} onClick={() => setTool('eraser')}>
                        <EraserIcon className="w-5 h-5" />
                    </ToolButton>
                    
                    <div className="flex items-center gap-2 bg-gray-600 p-2 rounded-md">
                        <label htmlFor="color-picker" className="sr-only">Color</label>
                        <input id="color-picker" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 bg-transparent border-none cursor-pointer" title="Select Color" />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-600 p-2 rounded-md">
                        <label htmlFor="line-width" className="text-sm font-semibold">Size</label>
                        <input
                            id="line-width"
                            type="range"
                            min="1"
                            max="50"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                            className="w-24 cursor-pointer"
                            title="Adjust Brush Size"
                        />
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <button onClick={clearCanvas} title="Clear Canvas" className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-red-600 rounded-md hover:bg-red-700 transition-colors">
                        <TrashIcon className="w-5 h-5" />
                        Clear
                    </button>
                    <button onClick={downloadImage} title="Download as PNG" className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-teal-600 rounded-md hover:bg-teal-700 transition-colors">
                        <DownloadIcon className="w-5 h-5" />
                        Save
                    </button>
                </div>
            </header>
            <main ref={containerRef} className="flex-1 bg-gray-800/50 relative overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={finishDrawing}
                    onMouseLeave={finishDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={finishDrawing}
                />
            </main>
        </div>
    );
};
