// DESTINATION: src/app/platform/institutions/[id]/moodle-setup/page.js
// Moodle integration is not used by AdvaTech LMS.
// This page redirects to the institution detail page.
'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function MoodleSetupRedirect() {
  const { id } = useParams()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/platform/institutions/${id}`)
  }, [id, router])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--text-muted)', fontSize: 14,
    }}>
      Redirecting…
    </div>
  )
}