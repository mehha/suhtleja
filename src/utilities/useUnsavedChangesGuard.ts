'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type PendingNavigation =
  | { type: 'href'; href: string }
  | { type: 'form'; form: HTMLFormElement; submitter: HTMLElement | null }

type UseUnsavedChangesGuardOptions = {
  enabled: boolean
  shouldGuardFormSubmit?: (form: HTMLFormElement, submitter: HTMLElement | null) => boolean
}

const defaultShouldGuardFormSubmit = (form: HTMLFormElement) =>
  form.hasAttribute('data-navigation-form')

export function useUnsavedChangesGuard({
  enabled,
  shouldGuardFormSubmit = defaultShouldGuardFormSubmit,
}: UseUnsavedChangesGuardOptions) {
  const router = useRouter()
  const [dialogOpen, setDialogOpenState] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)
  const [bypassGuard, setBypassGuard] = useState(false)

  const navigateToHref = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href)
      if (url.origin === window.location.origin) {
        router.push(`${url.pathname}${url.search}${url.hash}`)
        return
      }
      window.location.assign(url.href)
    },
    [router],
  )

  const openGuardDialog = useCallback((navigation: PendingNavigation) => {
    setPendingNavigation(navigation)
    setDialogOpenState(true)
  }, [])

  const setDialogOpen = useCallback((open: boolean) => {
    setDialogOpenState(open)
    if (!open) {
      setPendingNavigation(null)
    }
  }, [])

  const requestNavigation = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href)
      if (!enabled || bypassGuard) {
        navigateToHref(url.href)
        return
      }
      openGuardDialog({ type: 'href', href: url.href })
    },
    [bypassGuard, enabled, navigateToHref, openGuardDialog],
  )

  const confirmNavigation = useCallback(() => {
    if (!pendingNavigation) return
    setDialogOpenState(false)

    if (pendingNavigation.type === 'href') {
      const currentHref = window.location.href
      setBypassGuard(true)
      navigateToHref(pendingNavigation.href)
      setTimeout(() => {
        if (window.location.href === currentHref) {
          setBypassGuard(false)
        }
      }, 2000)
      return
    }

    if (!pendingNavigation.form.isConnected) {
      setBypassGuard(false)
      return
    }

    setBypassGuard(true)
    const currentHref = window.location.href
    if (pendingNavigation.submitter) {
      pendingNavigation.form.requestSubmit(pendingNavigation.submitter)
    } else {
      pendingNavigation.form.requestSubmit()
    }
    // If a form submission does not navigate away, re-enable guard after the attempt settles.
    setTimeout(() => {
      if (window.location.href === currentHref) {
        setBypassGuard(false)
      }
    }, 4000)
  }, [navigateToHref, pendingNavigation])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabled || bypassGuard) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [bypassGuard, enabled])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!enabled || bypassGuard) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!anchor) return
      if (anchor.hasAttribute('data-unsaved-guard-ignore')) return

      const href = anchor.getAttribute('href')
      if (!href) return
      if (anchor.hasAttribute('download')) return
      if (anchor.getAttribute('target') === '_blank') return
      if (href.startsWith('#')) return

      const url = new URL(href, window.location.href)
      const currentUrl = new URL(window.location.href)

      const isHashOnlyNavigation =
        url.origin === currentUrl.origin &&
        url.pathname === currentUrl.pathname &&
        url.search === currentUrl.search

      if (isHashOnlyNavigation || url.href === currentUrl.href) return

      event.preventDefault()
      openGuardDialog({ type: 'href', href: url.href })
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [bypassGuard, enabled, openGuardDialog])

  useEffect(() => {
    const handleDocumentSubmit = (event: Event) => {
      if (!enabled || bypassGuard) return
      if (event.defaultPrevented) return

      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      const submitEvent = event as SubmitEvent
      const submitter =
        submitEvent.submitter instanceof HTMLElement ? submitEvent.submitter : null

      if (!shouldGuardFormSubmit(form, submitter)) return

      event.preventDefault()
      openGuardDialog({ type: 'form', form, submitter })
    }

    document.addEventListener('submit', handleDocumentSubmit, true)
    return () => {
      document.removeEventListener('submit', handleDocumentSubmit, true)
    }
  }, [bypassGuard, enabled, openGuardDialog, shouldGuardFormSubmit])

  return {
    dialogOpen,
    setDialogOpen,
    confirmNavigation,
    requestNavigation,
  }
}
