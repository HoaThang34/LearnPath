import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import {
  AlertCircle, ArrowLeftRight, Bookmark, Check, CheckCircle2,
  ChevronRight, Compass, Crosshair, Filter, Info, Loader2,
  Minus, Plus, RotateCcw, Search, Sparkles, Star, Target, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const GROUP_COLORS = {
  'Kỹ thuật - Công nghệ': '#3b82f6',
  'Kinh tế - Quản trị':   '#f59e0b',
  'Y Dược':               '#10b981',
  'Xã hội - Nhân văn':    '#8b5cf6',
  'Nghệ thuật':           '#ec4899',
  'Khoa học':             '#06b6d4',
  'Nông Lâm':             '#84cc16',
  'Sư phạm':              '#f97316',
  'Luật - Hành chính':    '#6366f1',
}

const DEFAULT_GROUP_COLOR = '#64748b'
const STUDENT_ID = '__student__'
const EDGE_CAP = 6
const EDGE_THRESHOLD = 0.70

function normGroup(s) {
  return String(s || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
}

function getGroupColor(group) {
  const normalized = normGroup(group)
  for (const [key, color] of Object.entries(GROUP_COLORS)) {
    if (normGroup(key) === normalized) return color
  }
  return DEFAULT_GROUP_COLOR
}

function l2normalize(vec) {
  let ss = 0
  for (const k in vec) {
    const val = Number(vec[k]) || 0
    ss += val * val
  }
  const norm = Math.sqrt(ss)
  if (norm === 0) return {}
  const out = {}
  for (const k in vec) {
    out[k] = (Number(vec[k]) || 0) / norm
  }
  return out
}

function cosine(a, b) {
  let dot = 0
  for (const k in a) {
    if (k in b) dot += a[k] * b[k]
  }
  return dot
}

function getFitRating(fitPct) {
  if (fitPct === null || fitPct === undefined) {
    return { label: 'Chưa đủ điểm', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300' }
  }
  if (fitPct >= 80) {
    return { label: 'Rất phù hợp', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' }
  }
  if (fitPct >= 60) {
    return { label: 'Khá phù hợp', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' }
  }
  return { label: 'Cần nỗ lực', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300' }
}

export default function CareerMap({
  mapData = null,
  loading = false,
  error = null,
  compareIds = [],
  onToggleCompare = () => {},
  onOpenCompare = () => {},
  onSetTarget = () => {},
  onTogglePin = () => {},
  snapshot = { classLevel: '', term: '' },
  snapshots = [],
  onSnapshotChange = () => {},
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)

  // Filter States
  const [search, setSearch] = useState('')
  const [activeGroups, setActiveGroups] = useState(new Set())
  const [filterFitOnly, setFilterFitOnly] = useState(false)
  const [selectedMajor, setSelectedMajor] = useState(null)

  // Simulation and D3 references
  const simRef = useRef(null)
  const zoomBehaviorRef = useRef(null)
  const currentZoomTierRef = useRef('mid') // 'in' | 'mid' | 'out'

  // Stored graph model
  const graphModelRef = useRef({
    allNodes: [],
    allEdges: [],
    studentEdges: [],
    nodeById: new Map(),
    neighborsOf: new Map(),
    nodeSelection: null,
    linkSelection: null,
    studentLinkSelection: null,
  })

  // Extract all available groups from raw majors
  const availableGroups = useMemo(() => {
    const list = [...new Set((mapData?.majors || []).map((m) => normGroup(m.majorGroup)).filter(Boolean))]
    return list.sort((a, b) => a.localeCompare(b, 'vi'))
  }, [mapData])

  // Initialize all groups active when groups are loaded
  useEffect(() => {
    if (availableGroups.length > 0) {
      setActiveGroups(new Set(availableGroups))
    }
  }, [availableGroups])

  // Keep selectedMajor synchronized with updated mapData (e.g. after pin, target, unpin)
  useEffect(() => {
    if (selectedMajor && mapData?.majors) {
      const updated = mapData.majors.find((m) => String(m.id) === String(selectedMajor.id))
      if (updated) {
        setSelectedMajor((prev) => ({
          ...prev,
          ...updated,
          isPinned: Boolean(updated.isPinned),
          isTarget: Boolean(updated.isTarget),
          selectionId: updated.selectionId ?? null,
          selectionKind: updated.selectionKind ?? null,
        }))
      }
    }
  }, [mapData])

  // Radius helper based on entry score
  const radiusByScore = useMemo(() => {
    return d3.scaleLinear().domain([16, 29]).range([8, 20]).clamp(true)
  }, [])

  const getNodeRadius = useCallback((d) => {
    if (d.is_student) return 9
    const score = Number(d.entryScore)
    return Number.isFinite(score) && score > 0 ? radiusByScore(score) : 9
  }, [radiusByScore])

  // Filter check
  const passesFilter = useCallback((n, query, groups, fitOnly) => {
    if (!n) return false
    if (n.is_student) return true
    if (query) {
      const q = query.toLowerCase()
      const match = ((n.majorName || '') + ' ' + (n.schoolName || '') + ' ' + (n.schoolCode || '')).toLowerCase().includes(q)
      if (!match) return false
    }
    if (groups && groups.size > 0 && !groups.has(normGroup(n.majorGroup))) {
      return false
    }
    if (fitOnly && (n.fitPct === null || n.fitPct < 50)) {
      return false
    }
    return true
  }, [])

  // Apply Level of Detail (LOD), hover highlights, and search filters
  const applyLOD = useCallback(() => {
    const { nodeSelection, linkSelection, studentLinkSelection, neighborsOf } = graphModelRef.current
    if (!nodeSelection || !linkSelection || !studentLinkSelection) return

    const tier = currentZoomTierRef.current
    const activeTargetId = selectedMajor ? selectedMajor.id : null
    const isInteracting = Boolean(activeTargetId)
    const activeNeighbors = activeTargetId ? (neighborsOf.get(activeTargetId) || new Set()) : new Set()

    const q = search.trim()
    const fitOnly = filterFitOnly

    // Nodes opacity & styling
    nodeSelection.each(function (d) {
      const el = d3.select(this)
      if (d.is_student) {
        el.style('opacity', 1.0)
        return
      }

      const pass = passesFilter(d, q, activeGroups, fitOnly)
      if (!pass) {
        el.style('opacity', 0.06).style('pointer-events', 'none')
        el.select('text.node-label').attr('opacity', 0)
        return
      }

      el.style('pointer-events', 'all')

      if (isInteracting) {
        if (d.id === activeTargetId) {
          el.style('opacity', 1.0)
          el.select('circle.node-circle').attr('stroke', '#0f172a').attr('stroke-width', 2.8)
          el.select('text.node-label').attr('opacity', 1).attr('font-weight', '700').attr('fill', '#0f172a')
        } else if (activeNeighbors.has(d.id)) {
          el.style('opacity', 0.95)
          el.select('circle.node-circle').attr('stroke', '#ffffff').attr('stroke-width', 2.0)
          el.select('text.node-label').attr('opacity', 0.9).attr('font-weight', '600').attr('fill', '#334155')
        } else {
          el.style('opacity', 0.22)
          el.select('circle.node-circle').attr('stroke', '#ffffff').attr('stroke-width', 1.4)
          el.select('text.node-label').attr('opacity', 0)
        }
      } else {
        // Normal mode
        const alpha = d.fitPct >= 75 ? 1.0 : d.fitPct >= 50 ? 0.88 : (tier === 'out' ? 0.35 : 0.65)
        el.style('opacity', alpha)
        el.select('circle.node-circle').attr('stroke', '#ffffff').attr('stroke-width', 1.5)

        // Labels by zoom tier
        if (tier === 'in') {
          el.select('text.node-label').attr('opacity', 0.95).attr('font-weight', '500').attr('fill', '#334155')
        } else if (tier === 'mid') {
          el.select('text.node-label').attr('opacity', d.fitPct >= 60 ? 0.9 : 0.4).attr('font-weight', '500').attr('fill', '#334155')
        } else {
          // tier === 'out'
          el.select('text.node-label').attr('opacity', d.fitPct >= 80 ? 0.75 : 0)
        }
      }
    })

    // Similar edges opacity
    linkSelection.each(function (d) {
      const el = d3.select(this)
      const sId = typeof d.source === 'object' ? d.source.id : d.source
      const tId = typeof d.target === 'object' ? d.target.id : d.target
      const sNode = graphModelRef.current.nodeById.get(sId)
      const tNode = graphModelRef.current.nodeById.get(tId)

      if (!passesFilter(sNode, q, activeGroups, fitOnly) || !passesFilter(tNode, q, activeGroups, fitOnly)) {
        el.attr('stroke-opacity', 0)
        return
      }

      if (isInteracting) {
        if (sId === activeTargetId || tId === activeTargetId) {
          el.attr('stroke-opacity', 0.75).attr('stroke', '#334155').attr('stroke-width', 1.8)
        } else {
          el.attr('stroke-opacity', 0.03).attr('stroke', '#94a3b8').attr('stroke-width', 0.8)
        }
      } else {
        const baseAlpha = tier === 'out' ? 0.08 : tier === 'mid' ? 0.22 : 0.38
        el.attr('stroke-opacity', baseAlpha).attr('stroke', '#94a3b8').attr('stroke-width', 0.6 + d.sim * 1.2)
      }
    })

    // Student edges (red dashed)
    studentLinkSelection.each(function (d) {
      const el = d3.select(this)
      const tId = typeof d.target === 'object' ? d.target.id : d.target
      const tNode = graphModelRef.current.nodeById.get(tId)

      if (!passesFilter(tNode, q, activeGroups, fitOnly)) {
        el.attr('stroke-opacity', 0)
        return
      }

      if (isInteracting) {
        if (activeTargetId === STUDENT_ID || tId === activeTargetId) {
          el.attr('stroke-opacity', 0.95).attr('stroke-width', 2.0)
        } else {
          el.attr('stroke-opacity', 0.08).attr('stroke-width', 1.0)
        }
      } else {
        const baseAlpha = tier === 'out' ? 0.45 : tier === 'mid' ? 0.65 : 0.85
        el.attr('stroke-opacity', baseAlpha).attr('stroke-width', 1.3)
      }
    })
  }, [search, activeGroups, filterFitOnly, selectedMajor, passesFilter])

  const applyLODRef = useRef(applyLOD)
  applyLODRef.current = applyLOD

  // Re-apply LOD when filter or selection states change without restarting simulation
  useEffect(() => {
    applyLOD()
  }, [applyLOD])

  // Build and start D3 graph simulation
  useEffect(() => {
    if (!mapData || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 960
    const height = container.clientHeight || 720
    const cx = width / 2
    const cy = height / 2

    // 1. Build Nodes
    const rawMajors = mapData.majors || []
    const studentVector = mapData.studentVector || {}

    const allNodes = rawMajors.map((m) => {
      const weightVector = m.weightVector || {}
      return {
        id: String(m.id),
        schoolCode: m.schoolCode,
        schoolName: m.schoolName,
        majorName: m.majorName,
        majorGroup: m.majorGroup || 'Khác',
        admissionBlock: m.admissionBlock,
        entryScore: m.entryScore,
        fitPct: m.fitPct,
        coveragePct: m.coveragePct,
        details: m.details || [],
        weightVector,
        wNorm: l2normalize(weightVector),
        prioritySubject: m.prioritySubject,
        isTarget: Boolean(m.isTarget),
        isPinned: Boolean(m.isPinned),
        selectionId: m.selectionId ?? null,
        selectionKind: m.selectionKind ?? null,
        method: m.method || 'Điểm thi THPT',
        year: m.year || 2025,
        is_student: false,
      }
    })

    const studentNode = {
      id: STUDENT_ID,
      name: 'Bạn',
      majorName: 'Bạn',
      fitPct: 100,
      weightVector: studentVector,
      wNorm: l2normalize(studentVector),
      is_student: true,
      fx: cx,
      fy: cy,
      x: cx,
      y: cy,
    }
    allNodes.push(studentNode)

    // 2. Build mutual cosine edges between majors
    const majorNodes = allNodes.filter((n) => !n.is_student)
    const nearestOf = new Map()
    for (const a of majorNodes) {
      const scored = []
      for (const b of majorNodes) {
        if (a.id === b.id) continue
        const s = cosine(a.wNorm, b.wNorm)
        if (s >= EDGE_THRESHOLD) scored.push({ id: b.id, sim: s })
      }
      scored.sort((x, y) => y.sim - x.sim)
      nearestOf.set(a.id, scored.slice(0, EDGE_CAP))
    }

    const seen = new Set()
    const allEdges = []
    for (const a of majorNodes) {
      for (const { id: bId, sim } of nearestOf.get(a.id) || []) {
        const key = a.id < bId ? `${a.id}|${bId}` : `${bId}|${a.id}`
        if (seen.has(key)) continue
        const bTop = nearestOf.get(bId) || []
        if (!bTop.some((x) => x.id === a.id)) continue
        seen.add(key)
        allEdges.push({ source: a.id, target: bId, sim, kind: 'sim' })
      }
    }

    // 3. Build student edges (radiating to best fits in each group)
    const bestByGroup = new Map()
    for (const m of majorNodes) {
      if ((m.fitPct || 0) < 40) continue
      const g = normGroup(m.majorGroup)
      const cur = bestByGroup.get(g)
      if (!cur || (m.fitPct || 0) > (cur.fitPct || 0)) {
        bestByGroup.set(g, m)
      }
    }
    const studentEdges = [...bestByGroup.values()]
      .sort((a, b) => (b.fitPct || 0) - (a.fitPct || 0))
      .map((m) => ({ source: STUDENT_ID, target: m.id, fitPct: m.fitPct, kind: 'stu' }))

    // 4. Build indices
    const nodeById = new Map(allNodes.map((n) => [n.id, n]))
    const neighborsOf = new Map()
    const addNeighbor = (a, b) => {
      if (!neighborsOf.has(a)) neighborsOf.set(a, new Set())
      neighborsOf.get(a).add(b)
    }
    for (const e of allEdges) {
      addNeighbor(e.source, e.target)
      addNeighbor(e.target, e.source)
    }
    for (const e of studentEdges) {
      addNeighbor(STUDENT_ID, e.target)
      addNeighbor(e.target, STUDENT_ID)
    }

    // 5. Angular positioning by group
    const uniqueGroups = [...new Set(majorNodes.map((n) => normGroup(n.majorGroup)).filter(Boolean))].sort()
    const groupAngle = {}
    uniqueGroups.forEach((g, idx) => {
      groupAngle[g] = (2 * Math.PI * idx) / (uniqueGroups.length || 1) - Math.PI / 2
    })

    const MIN_R = 220
    const MAX_R = Math.max(width, height) * 0.90
    const targetRadius = (d) => {
      if (d.is_student) return 0
      const t = 1 - (d.fitPct || 0) / 100
      return MIN_R + (MAX_R - MIN_R) * t
    }

    const angleFor = (d) => {
      const g = normGroup(d.majorGroup)
      const base = groupAngle[g]
      if (base === undefined) return null
      const h = [...String(d.id)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
      const jitter = ((h >>> 0) % 1000 / 1000 - 0.5) * 0.75
      return base + jitter
    }

    const targetX = (d) => {
      if (d.is_student) return cx
      const a = angleFor(d)
      if (a === null) return cx
      return cx + targetRadius(d) * Math.cos(a)
    }

    const targetY = (d) => {
      if (d.is_student) return cy
      const a = angleFor(d)
      if (a === null) return cy
      return cy + targetRadius(d) * Math.sin(a)
    }

    // Initialize positions deterministically (preserve existing settled positions if available)
    const prevNodeById = graphModelRef.current?.nodeById || new Map()
    allNodes.forEach((n) => {
      const prev = prevNodeById.get(n.id)
      if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
        n.x = prev.x
        n.y = prev.y
        n.vx = 0
        n.vy = 0
      } else if (n.is_student) {
        n.x = cx
        n.y = cy
      } else {
        const tx = targetX(n)
        const ty = targetY(n)
        n.x = tx
        n.y = ty
      }
    })

    // 6. Setup SVG Canvas
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Defs & glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur')
    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'blur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const gRoot = svg.append('g').attr('class', 'graph-root')

    // Layers
    const linkLayer = gRoot.append('g').attr('class', 'links-sim')
    const stuLinkLayer = gRoot.append('g').attr('class', 'links-stu')
    const nodeLayer = gRoot.append('g').attr('class', 'nodes')

    // Render sim links
    const linkSel = linkLayer.selectAll('line.sim-link')
      .data(allEdges)
      .enter()
      .append('line')
      .attr('class', 'sim-link')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', (d) => 0.6 + d.sim * 1.2)
      .attr('stroke-opacity', 0.25)

    // Render student links (dashed red)
    const stuLinkSel = stuLinkLayer.selectAll('line.stu-link')
      .data(studentEdges)
      .enter()
      .append('line')
      .attr('class', 'stu-link')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1.3)
      .attr('stroke-dasharray', '4 3')
      .attr('stroke-opacity', 0.65)

    // Render nodes
    const nodeSel = nodeLayer.selectAll('g.node')
      .data(allNodes, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', (d) => `node ${d.is_student ? 'student' : 'major'}`)
      .style('cursor', (d) => (d.is_student ? 'default' : 'pointer'))

    // Student node rendering
    const stuG = nodeSel.filter((d) => d.is_student)
    stuG.append('circle').attr('r', 28).attr('fill', '#ef4444').attr('fill-opacity', 0.08)
    stuG.append('circle').attr('r', 17).attr('fill', '#ef4444').attr('fill-opacity', 0.16)
    stuG.append('circle').attr('r', 8).attr('fill', '#ef4444').attr('stroke', '#ffffff').attr('stroke-width', 2).attr('filter', 'url(#glow)')

    const noScores = Object.keys(studentVector).length === 0
    stuG.append('text')
      .attr('dy', -16)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', '#dc2626')
      .text(noScores ? 'Bạn (chưa có điểm)' : 'Bạn')

    // Major node circles
    const majorG = nodeSel.filter((d) => !d.is_student)

    // Outer ring for Target / Pinned
    majorG.each(function (d) {
      if (d.isTarget) {
        d3.select(this).append('circle')
          .attr('class', 'target-ring')
          .attr('r', getNodeRadius(d) + 5)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '3 2')
      } else if (d.isPinned) {
        d3.select(this).append('circle')
          .attr('class', 'pinned-ring')
          .attr('r', getNodeRadius(d) + 4)
          .attr('fill', 'none')
          .attr('stroke', '#9333ea')
          .attr('stroke-width', 2)
      }
    })

    majorG.append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => getGroupColor(d.majorGroup))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)

    majorG.append('text')
      .attr('class', 'node-label')
      .attr('dy', (d) => getNodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#334155')
      .attr('pointer-events', 'none')
      .text((d) => (d.majorName.length > 20 ? d.majorName.slice(0, 19) + '…' : d.majorName))

    // Drag behavior
    majorG.call(
      d3.drag()
        .on('start', (event, d) => {
          if (!event.active && simRef.current) simRef.current.alphaTarget(0.2).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active && simRef.current) simRef.current.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
    )

    // Node Click handler (hover interaction disabled to prevent jumping)
    majorG.on('click', (event, d) => {
      event.stopPropagation()
      d3.select(event.currentTarget).raise()
      setSelectedMajor(d)
    })

    // Click outside to clear selection
    svg.on('click', (event) => {
      if (event.target.closest('g.node')) return
      setSelectedMajor(null)
    })

    // 7. Setup Zoom
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 4.5])
      .on('zoom', (event) => {
        gRoot.attr('transform', event.transform)
        const k = event.transform.k
        const tier = k < 0.5 ? 'out' : k >= 1.25 ? 'in' : 'mid'
        if (tier !== currentZoomTierRef.current) {
          currentZoomTierRef.current = tier
          applyLOD()
        }
      })

    svg.call(zoomBehavior)
    zoomBehaviorRef.current = zoomBehavior

    // Center view initially
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0).scale(1))

    // 8. Setup Force Simulation
    const simLinks = [...allEdges, ...studentEdges]
    const simulation = d3.forceSimulation(allNodes)
      .force(
        'link',
        d3.forceLink(simLinks)
          .id((d) => d.id)
          .distance((e) => (e.kind === 'stu' ? 420 + 400 * (1 - (e.fitPct || 0) / 100) : 380 + 320 * (1 - e.sim)))
          .strength((e) => (e.kind === 'stu' ? 0.08 * ((e.fitPct || 0) / 100) : 0.22 * e.sim))
      )
      .force('charge', d3.forceManyBody().strength(-950))
      .force('collide', d3.forceCollide((d) => getNodeRadius(d) + 32))
      .force('x', d3.forceX(targetX).strength(0.32))
      .force('y', d3.forceY(targetY).strength(0.32))
      .alphaDecay(0.04)
      .alphaMin(0.01)

    simulation.on('tick', () => {
      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`)
      linkSel
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      stuLinkSel
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
    })

    simRef.current = simulation

    // Save references to model
    graphModelRef.current = {
      allNodes,
      allEdges,
      studentEdges,
      nodeById,
      neighborsOf,
      nodeSelection: nodeSel,
      linkSelection: linkSel,
      studentLinkSelection: stuLinkSel,
    }

    applyLODRef.current?.()

    return () => {
      simulation.stop()
    }
  }, [mapData, getNodeRadius])

  // Zoom control helpers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.35)
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.72)
  }

  const handleResetView = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
  }

  // Toggle major group filter
  const toggleGroup = (group) => {
    setActiveGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  const toggleAllGroups = () => {
    if (activeGroups.size === availableGroups.length) {
      setActiveGroups(new Set())
    } else {
      setActiveGroups(new Set(availableGroups))
    }
  }

  if (loading) {
    return (
      <div className="flex h-[600px] w-full flex-col items-center justify-center rounded-xl border bg-card p-8 text-center shadow-xs">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Đang tính toán toạ độ bản đồ ngành...</h3>
        <p className="mt-1 text-sm text-muted-foreground">Phân tích mức độ tương thích và dựng đồ thị mạng lưới năng lực của bạn.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="mt-3 text-base font-bold text-destructive">Không thể tải dữ liệu bản đồ ngành</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  const isSelectedComparing = selectedMajor && compareIds.includes(selectedMajor.id)

  return (
    <div className="relative flex flex-col space-y-3">
      {/* Top Filter and Controls Toolbar */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative min-w-[220px] max-w-[300px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm ngành hoặc trường..."
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Fit checkbox filter */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
            <input
              type="checkbox"
              checked={filterFitOnly}
              onChange={(e) => setFilterFitOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary/20"
            />
            <span>Ẩn ngành &lt; 50% fit</span>
          </label>

          {/* Snapshot selector if multiple */}
          {snapshots.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Snapshot:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={`${snapshot.classLevel}|${snapshot.term}`}
                onChange={(e) => {
                  const [classLevel, term] = e.target.value.split('|')
                  onSnapshotChange(classLevel, term)
                }}
              >
                {snapshots.map((item) => {
                  const [c, t] = item.split('|')
                  return (
                    <option key={item} value={item}>
                      Lớp {c} - {t}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="h-8 w-8 p-0"
              title="Phóng to"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="h-8 w-8 p-0"
              title="Thu nhỏ"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetView}
              className="h-8 w-8 p-0"
              title="Căn giữa lại bản đồ"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Group Filter Badges */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={toggleAllGroups}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
              activeGroups.size === availableGroups.length
                ? 'bg-slate-900 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Tất cả ({availableGroups.length})
          </button>
          {availableGroups.map((g) => {
            const active = activeGroups.has(g)
            const color = getGroupColor(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                style={{
                  backgroundColor: active ? `${color}18` : 'transparent',
                  borderColor: active ? `${color}60` : '#e2e8f0',
                  color: active ? color : '#94a3b8',
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  active ? 'shadow-2xs font-semibold' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: color }}
                />
                {g}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div
        ref={containerRef}
        className="relative h-[680px] w-full overflow-hidden rounded-xl border border-border bg-[#f8fafc] shadow-inner"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="h-full w-full cursor-grab active:cursor-grabbing select-none"
        />

        {/* Legend Box at Bottom-Left */}
        <div className="absolute bottom-3 left-3 z-10 max-w-[280px] rounded-lg border border-border/80 bg-white/95 p-3 text-[11px] text-muted-foreground shadow-md backdrop-blur-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-xs" />
            <span className="font-bold text-foreground">Bạn</span>
            <span>— vị trí năng lực hiện tại</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="font-medium text-foreground">Ngành</span>
            <span>— gần Bạn = fit cao, to = điểm cao</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-slate-400" />
            <span>Nối xám — yêu cầu môn học tương tự</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0 w-4 border-t-2 border-dashed border-rose-400" />
            <span className="text-rose-600 font-medium">Nối đỏ</span>
            <span>— top ngành phù hợp nhất từng nhóm</span>
          </div>
        </div>

        {/* Slide-out Detail Drawer on Major Click */}
        {selectedMajor && (
          <div className="absolute right-0 top-0 bottom-0 z-20 w-full sm:w-[360px] border-l border-border bg-card p-5 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white mb-1.5"
                    style={{ backgroundColor: getGroupColor(selectedMajor.majorGroup) }}
                  >
                    {selectedMajor.majorGroup}
                  </span>
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {selectedMajor.majorName}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                    {selectedMajor.schoolName} ({selectedMajor.schoolCode})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMajor(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Badges & Fit Display */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Độ phù hợp năng lực
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-extrabold text-foreground">
                      {selectedMajor.fitPct !== null ? `${selectedMajor.fitPct}%` : 'Chưa đủ điểm'}
                    </span>
                    {selectedMajor.fitPct !== null && (
                      <span className={`text-xs font-bold ${getFitRating(selectedMajor.fitPct).color}`}>
                        {getFitRating(selectedMajor.fitPct).label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Điểm chuẩn 2025
                  </div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {selectedMajor.entryScore ?? '—'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Khối {selectedMajor.admissionBlock}
                  </div>
                </div>
              </div>

              {/* Subject details */}
              <div className="mt-4">
                <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                  <span>Môn yêu cầu theo rubric</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Trọng số %</span>
                </div>
                <div className="space-y-2">
                  {(selectedMajor.details || []).map((d) => {
                    const weightPct = Math.round(Number(d.weight || 0) * 100)
                    const userScore = d.score
                    const gap = userScore !== null && Number.isFinite(userScore)
                      ? Math.round((userScore - d.threshold) * 100) / 100
                      : null

                    return (
                      <div key={d.subject} className="rounded-md border border-border/80 bg-background p-2 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-foreground">{d.subject}</span>
                          <span className="text-muted-foreground font-semibold">{weightPct}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            Điểm của bạn: <strong className="text-foreground">{userScore !== null ? userScore : '—'}</strong> / Ngưỡng: <strong>{d.threshold}</strong>
                          </span>
                          {gap !== null && (
                            <span className={`font-bold ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {gap >= 0 ? `+${gap}` : gap}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 space-y-2 border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={selectedMajor.isTarget ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSetTarget(selectedMajor)}
                  className={`text-xs ${selectedMajor.isTarget ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                >
                  <Star className={`mr-1.5 h-3.5 w-3.5 ${selectedMajor.isTarget ? 'fill-current' : ''}`} />
                  {selectedMajor.isTarget ? 'Mục tiêu' : 'Đặt mục tiêu'}
                </Button>

                <Button
                  type="button"
                  variant={selectedMajor.isPinned ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTogglePin(selectedMajor)}
                  className={`text-xs ${selectedMajor.isPinned ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                >
                  <Bookmark className={`mr-1.5 h-3.5 w-3.5 ${selectedMajor.isPinned ? 'fill-current' : ''}`} />
                  {selectedMajor.isPinned ? 'Đã ghim' : 'Ghim quan tâm'}
                </Button>
              </div>

              <Button
                type="button"
                variant={isSelectedComparing ? 'secondary' : 'default'}
                size="sm"
                onClick={() => onToggleCompare(selectedMajor.id)}
                className="w-full text-xs"
              >
                {isSelectedComparing ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                    Đã thêm so sánh (Xóa bỏ)
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Thêm vào so sánh đối chiếu
                  </>
                )}
              </Button>

              {/* Compare Stack preview if any items */}
              {compareIds.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Đang so sánh: <strong>{compareIds.length}/4</strong> ngành</span>
                    <button
                      type="button"
                      onClick={onOpenCompare}
                      className="font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      Xem so sánh <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
