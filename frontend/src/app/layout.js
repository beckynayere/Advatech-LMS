// DESTINATION: src/app/layout.js
import './globals.css'
import { AuthProvider } from '@/lib/context/AuthContext'
import { ToastProvider } from '@/lib/ToastContext'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata = {
  title: 'AdvaTech LMS',
  description: 'Multi-tenant Learning Management System for African institutions',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}