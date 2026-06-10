import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface LioneLayoutProps {
  preview: string
  children: React.ReactNode
}

export const LioneLayout = ({ preview, children }: LioneLayoutProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={card}>
          <Text style={brand}>LioneApps</Text>
          {children}
        </Section>
        <Hr style={hr} />
        <Section style={footer}>
          <Text style={footerLine}>LioneApps Platform</Text>
          <Text style={footerLine}>
            <Link href="https://lioneapps.com" style={footerLink}>
              https://lioneapps.com
            </Link>
          </Text>
          <Text style={footerSmall}>
            本邮件由系统自动发送，请勿直接回复。
          </Text>
          <Text style={footerSmall}>
            This email was sent automatically. Please do not reply.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const styles = {
  h1: {
    fontSize: '22px',
    fontWeight: 600 as const,
    color: '#111827',
    margin: '0 0 16px',
    textAlign: 'center' as const,
  },
  text: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.6',
    margin: '0 0 14px',
  },
  textMuted: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.6',
    margin: '0 0 12px',
  },
  buttonWrap: {
    textAlign: 'center' as const,
    margin: '28px 0',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '999px',
    padding: '13px 32px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  code: {
    fontFamily: 'SFMono-Regular, Menlo, monospace',
    fontSize: '32px',
    fontWeight: 700 as const,
    letterSpacing: '10px',
    color: '#111827',
    textAlign: 'center' as const,
    margin: '24px 0',
    padding: '18px',
    backgroundColor: '#f3f4f6',
    borderRadius: '12px',
  },
  divider: {
    borderTop: '1px solid #e5e7eb',
    margin: '20px 0',
  },
  langLabel: {
    fontSize: '11px',
    fontWeight: 600 as const,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    margin: '0 0 8px',
  },
}

const main = {
  backgroundColor: '#f5f5f7',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: '32px 12px',
}
const outer = { maxWidth: '520px', margin: '0 auto' }
const card = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  padding: '36px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}
const brand = {
  fontSize: '13px',
  fontWeight: 600 as const,
  color: '#2563eb',
  letterSpacing: '1px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
  textTransform: 'uppercase' as const,
}
const hr = { border: 'none', margin: '20px 0 0' }
const footer = { textAlign: 'center' as const, padding: '16px 0 0' }
const footerLine = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '2px 0',
  textAlign: 'center' as const,
}
const footerLink = { color: '#6b7280', textDecoration: 'none' }
const footerSmall = {
  fontSize: '11px',
  color: '#9ca3af',
  margin: '8px 0 0',
  textAlign: 'center' as const,
}
