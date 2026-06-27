'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PanelReturnBar from '@/app/components/PanelReturnBar';

export type WorkflowView = 'list' | 'builder';

// Sidebar nav entries (one per view). A host panel can render these as a
// cascading submenu — «اتوماسیون‌های من» (the saved list) and «سازندهٔ اتوماسیون»
// (the builder canvas).
export const WORKFLOW_VIEWS: { id: WorkflowView; label: string; icon: string }[] = [
  { id: 'list', icon: '☰', label: 'اتوماسیون‌های من' },
  { id: 'builder', icon: '⚡', label: 'سازندهٔ اتوماسیون' },
];

// API shape for a saved workflow (mirrors app/lib/workflow-store.ts).
interface SavedWorkflow {
  id: string;
  name: string;
  nodes?: WorkflowNode[];
  enabled?: boolean;
  updatedAt?: number;
}

type NodeType = 'trigger' | 'action' | 'ai' | 'condition' | 'end';

interface WorkflowNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  config: Record<string, string>;
}

interface Connection {
  from: string;
  to: string;
}

const BLOCK_CATEGORIES = [
  {
    label: 'شروع',
    type: 'trigger' as NodeType,
    color: '#22c55e',
    items: ['لید جدید', 'بازدید جدید', 'تغییر وضعیت'],
  },
  {
    label: 'اقدام',
    type: 'action' as NodeType,
    color: '#3b82f6',
    items: ['ارسال پیام', 'ایجاد وظیفه', 'بروزرسانی CRM'],
  },
  {
    label: 'هوش مصنوعی',
    type: 'ai' as NodeType,
    color: '#a855f7',
    items: ['تحلیل لید', 'پیشنهاد قیمت', 'توضیح ملک'],
  },
  {
    label: 'شرط',
    type: 'condition' as NodeType,
    color: '#f59e0b',
    items: ['بررسی بودجه', 'فیلتر منطقه'],
  },
  {
    label: 'پایان',
    type: 'end' as NodeType,
    color: '#6b7280',
    items: ['بستن لید', 'تبدیل به مشتری'],
  },
];

const NODE_COLORS: Record<NodeType, string> = {
  trigger: '#22c55e',
  action: '#3b82f6',
  ai: '#a855f7',
  condition: '#f59e0b',
  end: '#6b7280',
};

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger: 'شروع',
  action: 'اقدام',
  ai: 'هوش مصنوعی',
  condition: 'شرط',
  end: 'پایان',
};

const CONFIG_FIELDS: Record<NodeType, { key: string; label: string; placeholder: string }[]> = {
  trigger: [
    { key: 'source', label: 'منبع لید', placeholder: 'مثال: وب‌سایت، تلگرام' },
    { key: 'filter', label: 'فیلتر اولیه', placeholder: 'مثال: تهران، بالای ۵۰۰ میلیون' },
  ],
  action: [
    { key: 'delay', label: 'تأخیر (دقیقه)', placeholder: 'مثال: ۱۵' },
    { key: 'template', label: 'قالب پیام', placeholder: 'متن پیام را وارد کنید' },
    { key: 'assignee', label: 'مسئول', placeholder: 'نام مشاور' },
  ],
  ai: [
    { key: 'model', label: 'مدل AI', placeholder: 'مثال: GPT-4، Claude' },
    { key: 'prompt', label: 'دستور', placeholder: 'دستورالعمل برای مدل' },
    { key: 'threshold', label: 'حد آستانه', placeholder: 'مثال: ۷۵ درصد' },
  ],
  condition: [
    { key: 'field', label: 'فیلد بررسی', placeholder: 'مثال: بودجه، منطقه' },
    { key: 'operator', label: 'عملگر', placeholder: 'مثال: بزرگ‌تر از، برابر با' },
    { key: 'value', label: 'مقدار', placeholder: 'مقدار مقایسه' },
  ],
  end: [
    { key: 'reason', label: 'دلیل', placeholder: 'مثال: خرید موفق، انصراف' },
    { key: 'note', label: 'یادداشت', placeholder: 'توضیحات اضافی' },
  ],
};

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: 'n1',
    label: 'لید جدید',
    type: 'trigger',
    x: 80,
    y: 160,
    config: { source: 'وب‌سایت', filter: 'تهران' },
  },
  {
    id: 'n2',
    label: 'AI تحلیل',
    type: 'ai',
    x: 300,
    y: 120,
    config: { model: 'Claude', prompt: 'تحلیل کن', threshold: '70' },
  },
  {
    id: 'n3',
    label: 'تخصیص مشاور',
    type: 'action',
    x: 520,
    y: 200,
    config: { delay: '5', assignee: 'احمد رضایی' },
  },
  {
    id: 'n4',
    label: 'ارسال پیام',
    type: 'action',
    x: 520,
    y: 340,
    config: { delay: '10', template: 'سلام، با شما تماس می‌گیریم' },
  },
  {
    id: 'n5',
    label: 'بستن',
    type: 'end',
    x: 740,
    y: 260,
    config: { reason: 'خرید موفق', note: '' },
  },
];

const CONNECTIONS: Connection[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n3', to: 'n4' },
  { from: 'n4', to: 'n5' },
];

const NODE_ORDER = ['n1', 'n2', 'n3', 'n4', 'n5'];

export default function WorkflowTool({ embedded = false, view: viewProp, onView }: { embedded?: boolean; view?: WorkflowView; onView?: (v: WorkflowView) => void }) {
  const [internalView, setInternalView] = useState<WorkflowView>('builder');
  const activeView: WorkflowView = viewProp ?? internalView;
  const setActiveView = (v: WorkflowView) => { onView ? onView(v) : setInternalView(v); };
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [selectedId, setSelectedId] = useState<string | null>('n1');
  const [isRunning, setIsRunning] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(-1);
  const [status, setStatus] = useState<string>('آماده');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('گردش کار جدید');
  const [enabled, setEnabled] = useState(false);   // اتوماسیون فعال است؟
  // Saved workflows for the «اتوماسیون‌های من» list view.
  const [savedList, setSavedList] = useState<SavedWorkflow[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const getNodeCenter = (node: WorkflowNode) => ({
    x: node.x + 80,
    y: node.y + 30,
  });

  const handleRunTest = useCallback(() => {
    if (isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setActiveNodeIndex(-1);
      setStatus('متوقف شد');
      return;
    }
    setIsRunning(true);
    setStatus('در حال اجرا...');
    setActiveNodeIndex(0);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx += 1;
      if (idx >= NODE_ORDER.length) {
        clearInterval(intervalRef.current!);
        setIsRunning(false);
        setActiveNodeIndex(-1);
        setStatus('اجرا کامل شد ✓');
      } else {
        setActiveNodeIndex(idx);
      }
    }, 900);
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Load the most recently saved workflow on mount (if any).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/workflow');
        if (!res.ok) return;
        const data = await res.json();
        const recent = data.workflows?.[0];
        if (!recent || cancelled) return;
        setWorkflowId(recent.id);
        setWorkflowName(recent.name);
        if (Array.isArray(recent.nodes) && recent.nodes.length) {
          setNodes(recent.nodes);
        }
      } catch {
        /* ignore — keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch the saved-workflows list (used by the list view and after saving).
  const refreshList = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow');
      if (!res.ok) { setListLoaded(true); return; }
      const data = await res.json();
      setSavedList(Array.isArray(data.workflows) ? data.workflows : []);
    } catch {
      /* ignore — keep current list */
    } finally {
      setListLoaded(true);
    }
  }, []);

  // Load the list whenever the list view becomes active.
  useEffect(() => {
    if (activeView === 'list') refreshList();
  }, [activeView, refreshList]);

  // Load a saved workflow into the builder, then switch to it.
  const loadWorkflow = useCallback((wf: SavedWorkflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setEnabled(!!wf.enabled);
    if (Array.isArray(wf.nodes) && wf.nodes.length) setNodes(wf.nodes);
    setSelectedId(null);
    setActiveView('builder');
  }, [setActiveView]);

  // Start a fresh, blank workflow in the builder.
  const newWorkflow = useCallback(() => {
    setWorkflowId(null);
    setWorkflowName('گردش کار جدید');
    setEnabled(false);
    setNodes(INITIAL_NODES);
    setSelectedId('n1');
    setStatus('آماده');
    setActiveView('builder');
  }, [setActiveView]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setStatus('در حال ذخیره...');
    try {
      const res = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflowId,
          name: workflowName,
          nodes,
          connections: CONNECTIONS,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(res.status === 401 ? 'برای ذخیره وارد شوید' : (err.error || 'خطا در ذخیره'));
        return;
      }
      const data = await res.json();
      if (data.workflow?.id) setWorkflowId(data.workflow.id);
      setSaved(true);
      setStatus('ذخیره شد ✓');
      refreshList();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setStatus('خطا در اتصال');
    } finally {
      setSaving(false);
    }
  }, [saving, workflowId, workflowName, nodes, enabled, refreshList]);

  const handleNodeClick = (id: string) => {
    setSelectedId(id);
  };

  const handleConfigChange = (key: string, value: string) => {
    if (!selectedId) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, config: { ...n.config, [key]: value } } : n
      )
    );
  };

  const handleLabelChange = (value: string) => {
    if (!selectedId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedId ? { ...n, label: value } : n))
    );
  };

  const isNodeActive = (nodeId: string) => {
    if (!isRunning || activeNodeIndex < 0) return false;
    return NODE_ORDER[activeNodeIndex] === nodeId;
  };

  // ===== LIST VIEW: «اتوماسیون‌های من» — saved workflows as cards. =====
  const listContent = (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header + new button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
            اتوماسیون‌های من
          </span>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {savedList.length} اتوماسیون
          </span>
        </div>
        <button
          onClick={newWorkflow}
          style={{
            padding: '9px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--gold)',
            color: '#000',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'inherit',
          }}
        >
          ＋ اتوماسیون جدید
        </button>
      </div>

      {/* Empty state */}
      {listLoaded && savedList.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--muted)',
          }}
        >
          <span style={{ fontSize: '40px', opacity: 0.6 }}>⚡</span>
          <div style={{ fontSize: '14px' }}>هنوز اتوماسیونی ذخیره نشده است.</div>
          <button
            onClick={newWorkflow}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--gold)',
              color: '#000',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            ＋ اتوماسیون جدید
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '14px',
          }}
        >
          {savedList.map((wf) => (
            <div
              key={wf.id}
              onClick={() => loadWorkflow(wf)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--goldDim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    color: 'var(--gold)',
                    flexShrink: 0,
                  }}
                >
                  ⚡
                </div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {wf.name || 'بدون نام'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--muted)',
                }}
              >
                <span>{wf.nodes?.length ?? 0} گره</span>
                {wf.updatedAt && (
                  <span>{new Date(wf.updatedAt).toLocaleDateString('fa-IR')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // The inner builder content (topbar + three-panel layout) — shared by both
  // standalone and embedded modes.
  const content = (
    <>
      {/* Topbar */}
      <div
        style={{
          width: '100%',
          height: '56px',
          background: 'var(--navbg)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxShadow: 'var(--shadow)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* فعال‌سازیِ اتوماسیون — تا روشن نشود اجرا نمی‌شود */}
          <button
            onClick={() => setEnabled(v => !v)}
            title="با روشن‌بودن، این اتوماسیون روی رویدادهای جدید اجرا می‌شود"
            style={{
              padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              border: `1px solid ${enabled ? '#22c55e' : 'var(--line)'}`,
              background: enabled ? 'rgba(34,197,94,.14)' : 'var(--surface)',
              color: enabled ? '#22c55e' : 'var(--muted)', transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            {enabled ? '● فعال' : '○ غیرفعال'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: saved ? 'var(--gold)' : 'var(--surface)',
              color: saved ? '#000' : 'var(--text)',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'در حال ذخیره...' : saved ? 'ذخیره شد ✓' : 'ذخیره'}
          </button>
          <button
            onClick={handleRunTest}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: 'none',
              background: isRunning ? '#ef4444' : 'var(--gold)',
              color: isRunning ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s',
            }}
          >
            {isRunning ? 'توقف' : 'اجرای تست'}
          </button>
          <span
            style={{
              fontSize: '12px',
              color: isRunning ? 'var(--gold)' : 'var(--muted)',
              fontWeight: isRunning ? 600 : 400,
              minWidth: '100px',
            }}
          >
            {status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '0.5px',
            }}
          >
            سازنده اتوماسیون
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ⚡
          </div>
        </div>
      </div>

      {/* Three-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel: Block types */}
        <div
          className="mjw-palette"
          style={{
            width: '240px',
            flexShrink: 0,
            background: 'var(--bg2)',
            borderLeft: '1px solid var(--line)',
            overflowY: 'auto',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '0 6px', fontWeight: 600, letterSpacing: '1px' }}>
            بلوک‌های گردش کار
          </div>
          {BLOCK_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: cat.color,
                  padding: '2px 8px 6px',
                  borderBottom: `1px solid var(--line2)`,
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cat.items.map((item) => (
                  <div
                    key={item}
                    draggable
                    title={`${cat.label}: ${item}`}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--line2)',
                      cursor: 'grab',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--faint)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = cat.color;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line2)';
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--bg)',
            backgroundImage:
              'radial-gradient(circle, var(--line2) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          {/* SVG connections */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="var(--muted)" />
              </marker>
            </defs>
            {CONNECTIONS.map((conn) => {
              const fromNode = nodes.find((n) => n.id === conn.from);
              const toNode = nodes.find((n) => n.id === conn.to);
              if (!fromNode || !toNode) return null;
              const from = getNodeCenter(fromNode);
              const to = getNodeCenter(toNode);
              const mx = (from.x + to.x) / 2;
              return (
                <path
                  key={`${conn.from}-${conn.to}`}
                  d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                  strokeDasharray="none"
                  markerEnd="url(#arrowhead)"
                  opacity={0.5}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const color = NODE_COLORS[node.type];
            const active = isNodeActive(node.id);
            const selected = selectedId === node.id;
            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: '160px',
                  zIndex: 2,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{
                    background: 'var(--surface)',
                    border: `2px solid ${active ? 'var(--gold)' : selected ? color : 'var(--line)'}`,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    boxShadow: active
                      ? '0 0 0 3px var(--goldDim), 0 4px 16px rgba(0,0,0,0.3)'
                      : selected
                      ? `0 0 0 2px ${color}44`
                      : '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.25s',
                    animation: active ? 'pulse 0.9s infinite' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                        boxShadow: active ? `0 0 6px ${color}` : 'none',
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      {node.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: color,
                      fontWeight: 600,
                      background: `${color}18`,
                      borderRadius: '4px',
                      padding: '1px 6px',
                      display: 'inline-block',
                    }}
                  >
                    {NODE_TYPE_LABELS[node.type]}
                  </div>
                </div>
              </div>
            );
          })}

          <style>{`
            @keyframes pulse {
              0%, 100% { box-shadow: 0 0 0 3px var(--goldDim), 0 4px 16px rgba(0,0,0,0.3); }
              50% { box-shadow: 0 0 0 6px var(--goldDim), 0 4px 20px rgba(0,0,0,0.4); }
            }
          `}</style>
        </div>

        {/* Right panel: Settings */}
        <div
          className="mjw-config"
          style={{
            width: '280px',
            flexShrink: 0,
            background: 'var(--bg2)',
            borderRight: '1px solid var(--line)',
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {selectedNode ? (
            <>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 600, letterSpacing: '1px' }}>
                  تنظیمات گره
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                      نام گره
                    </label>
                    <input
                      value={selectedNode.label}
                      onChange={(e) => handleLabelChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                      نوع
                    </label>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: `${NODE_COLORS[selectedNode.type]}18`,
                        border: `1px solid ${NODE_COLORS[selectedNode.type]}44`,
                        borderRadius: '6px',
                        padding: '4px 10px',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: NODE_COLORS[selectedNode.type],
                        }}
                      />
                      <span style={{ fontSize: '12px', color: NODE_COLORS[selectedNode.type], fontWeight: 700 }}>
                        {NODE_TYPE_LABELS[selectedNode.type]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 600, letterSpacing: '1px' }}>
                  پیکربندی
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {CONFIG_FIELDS[selectedNode.type].map((field) => (
                    <div key={field.key}>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                        {field.label}
                      </label>
                      {field.key === 'template' || field.key === 'prompt' ? (
                        <textarea
                          value={selectedNode.config[field.key] ?? ''}
                          onChange={(e) => handleConfigChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <input
                          value={selectedNode.config[field.key] ?? ''}
                          onChange={(e) => handleConfigChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 600, letterSpacing: '1px' }}>
                  اتصالات
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {CONNECTIONS.filter((c) => c.from === selectedId || c.to === selectedId).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--faint)' }}>اتصالی وجود ندارد</div>
                  ) : (
                    CONNECTIONS.filter((c) => c.from === selectedId || c.to === selectedId).map((conn) => {
                      const isOut = conn.from === selectedId;
                      const otherId = isOut ? conn.to : conn.from;
                      const other = nodes.find((n) => n.id === otherId);
                      return (
                        <div
                          key={`${conn.from}-${conn.to}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--text)',
                          }}
                        >
                          <span style={{ color: isOut ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
                            {isOut ? '→' : '←'}
                          </span>
                          <span>{other?.label ?? otherId}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
                            ({isOut ? 'خروجی' : 'ورودی'})
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '20px',
              }}
            >
              یک گره را انتخاب کنید تا تنظیمات آن را ببینید
            </div>
          )}
        </div>
      </div>
    </>
  );

  // ===== EMBEDDED MODE: only the inner content area (no return-bar/full-page wrapper). =====
  if (embedded) {
    return (
      <div
        dir="rtl"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'Vazirmatn, Tahoma, sans-serif',
          overflow: 'hidden',
        }}
      >
        {activeView === 'list' ? listContent : content}
      </div>
    );
  }

  // ===== STANDALONE MODE: full page, pixel-identical to the original /workflow. =====
  return (
    <div
      dir="rtl"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'Vazirmatn, Tahoma, sans-serif',
        overflow: 'hidden',
      }}
    >
      <PanelReturnBar tool="اتوماسیون" />
      {content}
    </div>
  );
}
