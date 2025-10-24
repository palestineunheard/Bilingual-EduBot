import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import { toPng } from 'html-to-image';
import type { MindMapData } from '../types';
import { SpinnerIcon } from './icons';

declare global {
  interface Window {
    html2pdf: any;
    jspdf: any;
  }
}

interface MindMapProps {
  data: MindMapData;
}

const nodeColor = (node: any) => {
    // Add custom color for collapsed nodes in the minimap
    if (node.data?.isCollapsed) return '#f59e0b'; // Amber-500 for collapsed nodes
    switch (node.type) {
        case 'input':
            return '#6366f1'; // Indigo-500 for root node
        default:
            return '#1f2937'; // Gray-800 for other nodes
    }
};

const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(data.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(data.edges);
  const mindMapRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // State to track IDs of collapsed nodes
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  // Memoize an adjacency list (children map) for efficient traversal
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    data.edges.forEach(edge => {
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }
      map.get(edge.source)!.push(edge.target);
    });
    return map;
  }, [data.edges]);

  // Callback to handle node clicks for expanding/collapsing branches
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    const isLeaf = !childrenMap.has(node.id);
    // Do nothing if a leaf node is clicked
    if (isLeaf) return;

    // Toggle the collapsed state of the clicked node
    setCollapsedNodeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        newSet.delete(node.id); // Expand the node
      } else {
        newSet.add(node.id); // Collapse the node
      }
      return newSet;
    });
  }, [childrenMap]);

  // Effect to update node visibility and styling based on the collapsed state
  useEffect(() => {
    // Helper to get all descendant node IDs for a given node
    const getDescendants = (startNodeId: string): Set<string> => {
        const descendants = new Set<string>();
        const queue = [startNodeId];
        const visited = new Set([startNodeId]);
        
        while (queue.length > 0) {
          const currentNodeId = queue.shift()!;
          const children = childrenMap.get(currentNodeId) || [];
          for (const childId of children) {
            if (!visited.has(childId)) {
              visited.add(childId);
              descendants.add(childId);
              queue.push(childId);
            }
          }
        }
        return descendants;
    };

    const hiddenNodeIds = new Set<string>();
    collapsedNodeIds.forEach(id => {
      getDescendants(id).forEach(descendantId => hiddenNodeIds.add(descendantId));
    });

    setNodes(
      data.nodes.map(node => {
        const isCollapsed = collapsedNodeIds.has(node.id);
        const isLeaf = !childrenMap.has(node.id);
        
        const style: React.CSSProperties = { ...node.style };
        
        // Add visual indicators for interactivity
        if (!isLeaf) {
            style.cursor = 'pointer';
            style.borderWidth = '2px';
            style.borderStyle = 'solid';
            // Use different border colors to indicate expanded/collapsed state
            style.borderColor = isCollapsed ? '#f59e0b' : '#10b981'; // Amber-500 vs Emerald-500
        }

        return {
          ...node,
          hidden: hiddenNodeIds.has(node.id),
          style,
          data: {
            ...node.data,
            isCollapsed,
          }
        };
      })
    );
  }, [data.nodes, collapsedNodeIds, setNodes, childrenMap]);


  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleExport = useCallback(async () => {
    const mindMapElement = mindMapRef.current;
    if (!mindMapElement || isExporting) {
      return;
    }

    // Capture the .react-flow__renderer element which contains the viewport and the background
    const elementToCapture = mindMapElement.querySelector('.react-flow__renderer');
    if (!elementToCapture) {
      alert('Could not find mind map content to export.');
      return;
    }

    setIsExporting(true);
    mindMapElement.classList.add('mind-map-exporting');

    try {
      const dataUrl = await toPng(elementToCapture as HTMLElement, {
        pixelRatio: 3, // High resolution for crisp PDF output
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const imgWidth = img.width;
        const imgHeight = img.height;
        const margin = 40; // 20pt margin on each side

        const ratio = Math.min((pdfWidth - margin) / imgWidth, (pdfHeight - margin) / imgHeight);
        const w = imgWidth * ratio;
        const h = imgHeight * ratio;

        const x = (pdfWidth - w) / 2;
        const y = (pdfHeight - h) / 2;

        pdf.addImage(dataUrl, 'PNG', x, y, w, h);
        pdf.save('mind-map.pdf');

        mindMapElement.classList.remove('mind-map-exporting');
        setIsExporting(false);
      }
      img.onerror = () => {
          throw new Error('Image could not be loaded for PDF generation.');
      }

    } catch (err: any) {
        console.error("PDF export failed:", err);
        alert('Sorry, there was an error exporting the mind map. The content might be too complex.');
        mindMapElement.classList.remove('mind-map-exporting');
        setIsExporting(false);
    }
  }, [isExporting]);

  return (
    <div className="w-full h-full relative" ref={mindMapRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
        className="bg-gray-900"
        nodesDraggable={false}
      >
        <Controls />
        <MiniMap nodeStrokeColor={nodeColor} nodeColor={nodeColor} zoomable pannable />
        <Background gap={16} color="#4b5563" />
      </ReactFlow>
      <div className="absolute top-4 right-4 z-10 export-button">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
        >
          {isExporting ? (
            <>
              <SpinnerIcon className="w-5 h-5" />
              <span>Saving...</span>
            </>
          ) : (
            'Save as PDF'
          )}
        </button>
      </div>
    </div>
  );
};

export default MindMap;
