import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { api, errorMessage } from '../lib/api'
import type {
  Alert,
  CaseDetail,
  CaseSummary,
  NewAnalysisOptions,
} from '../types'
import { useAuth } from './AuthContext'

interface CaseContextValue {
  cases: CaseSummary[]
  activeCase: CaseDetail | null
  activeId: string | null
  loadingCases: boolean
  loadingCase: boolean
  error: string | null
  selectCase: (caseId: string) => void
  refreshCases: () => Promise<void>
  createSample: (options: NewAnalysisOptions) => Promise<CaseDetail>
  uploadCase: (
    files: File[],
    options: NewAnalysisOptions,
    name: string,
  ) => Promise<CaseDetail>
  deleteCase: (caseId: string) => Promise<void>
  applyAlertUpdate: (alert: Alert) => void
  isNewAnalysisOpen: boolean
  openNewAnalysis: () => void
  closeNewAnalysis: () => void
}

const CaseContext = createContext<CaseContextValue | null>(null)

const STORAGE_KEY = 'lf-active-case'

function toSummary(detail: CaseDetail): CaseSummary {
  return {
    id: detail.id,
    name: detail.name,
    source: detail.source,
    created_at: detail.created_at,
    timezone: detail.timezone,
    year: detail.year,
    parser: detail.parser,
    summary: detail.summary,
  }
}

export function CaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeCase, setActiveCase] = useState<CaseDetail | null>(null)
  const [loadingCases, setLoadingCases] = useState(false)
  const [loadingCase, setLoadingCase] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNewAnalysisOpen, setNewAnalysisOpen] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!user) {
      setCases([])
      setActiveId(null)
      setActiveCase(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoadingCases(true)
    setError(null)
    api
      .listCases()
      .then((items) => {
        if (cancelled) return
        setCases(items)
        setActiveId((current) => {
          if (current && items.some((item) => item.id === current)) return current
          const stored = localStorage.getItem(STORAGE_KEY)
          if (stored && items.some((item) => item.id === stored)) return stored
          return items[0]?.id ?? null
        })
        if (items.length === 0) setActiveCase(null)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoadingCases(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user || !activeId) {
      setActiveCase(null)
      setLoadingCase(false)
      return
    }
    const requestId = ++requestRef.current
    setLoadingCase(true)
    setError(null)
    api
      .getCase(activeId)
      .then((payload) => {
        if (requestId === requestRef.current) {
          setActiveCase(payload)
          localStorage.setItem(STORAGE_KEY, payload.id)
          setCases((current) =>
            current.map((item) =>
              item.id === payload.id ? { ...item, summary: payload.summary } : item,
            ),
          )
        }
      })
      .catch((err) => {
        if (requestId === requestRef.current) {
          setError(errorMessage(err))
          setActiveCase(null)
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoadingCase(false)
      })
    return () => {
      // The request id guard makes late responses harmless.
    }
  }, [user, activeId])

  const selectCase = useCallback((caseId: string) => {
    setActiveId(caseId)
    localStorage.setItem(STORAGE_KEY, caseId)
  }, [])

  const refreshCases = useCallback(async () => {
    setLoadingCases(true)
    try {
      const items = await api.listCases()
      setCases(items)
      setActiveId((current) => {
        if (current && items.some((item) => item.id === current)) return current
        return items[0]?.id ?? null
      })
      if (items.length === 0) setActiveCase(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoadingCases(false)
    }
  }, [])

  const adoptCase = useCallback((detail: CaseDetail) => {
    setActiveCase(detail)
    setActiveId(detail.id)
    localStorage.setItem(STORAGE_KEY, detail.id)
    setCases((current) => {
      const summary = toSummary(detail)
      const next = current.filter((item) => item.id !== detail.id)
      return [summary, ...next]
    })
  }, [])

  const createSample = useCallback(
    async (options: NewAnalysisOptions) => {
      const detail = await api.createSampleCase(options)
      adoptCase(detail)
      return detail
    },
    [adoptCase],
  )

  const uploadCase = useCallback(
    async (files: File[], options: NewAnalysisOptions, name: string) => {
      const detail = await api.createCase(files, options, name)
      adoptCase(detail)
      return detail
    },
    [adoptCase],
  )

  const deleteCase = useCallback(
    async (caseId: string) => {
      await api.deleteCase(caseId)
      const remaining = cases.filter((item) => item.id !== caseId)
      setCases(remaining)
      if (activeId === caseId) {
        setActiveId(remaining[0]?.id ?? null)
        if (remaining.length === 0) setActiveCase(null)
      }
    },
    [activeId, cases],
  )

  const applyAlertUpdate = useCallback((alert: Alert) => {
    setActiveCase((current) =>
      current
        ? {
            ...current,
            alerts: current.alerts.map((item) =>
              item.alert_id === alert.alert_id ? alert : item,
            ),
          }
        : current,
    )
  }, [])

  const openNewAnalysis = useCallback(() => setNewAnalysisOpen(true), [])
  const closeNewAnalysis = useCallback(() => setNewAnalysisOpen(false), [])

  const value = useMemo(
    () => ({
      cases,
      activeCase,
      activeId,
      loadingCases,
      loadingCase,
      error,
      selectCase,
      refreshCases,
      createSample,
      uploadCase,
      deleteCase,
      applyAlertUpdate,
      isNewAnalysisOpen,
      openNewAnalysis,
      closeNewAnalysis,
    }),
    [
      cases,
      activeCase,
      activeId,
      loadingCases,
      loadingCase,
      error,
      selectCase,
      refreshCases,
      createSample,
      uploadCase,
      deleteCase,
      applyAlertUpdate,
      isNewAnalysisOpen,
      openNewAnalysis,
      closeNewAnalysis,
    ],
  )

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
}

export function useCases() {
  const context = useContext(CaseContext)
  if (!context) throw new Error('useCases must be used inside CaseProvider')
  return context
}
