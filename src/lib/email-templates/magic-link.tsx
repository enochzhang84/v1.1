import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  token: string
}

export const MagicLinkEmail = ({
  token,
}: MagicLinkEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>登录验证码</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>登录验证码</Text>
        <Text style={bodyText}>您的验证码为：</Text>
        <Section style={tokenSection}>
          <Text style={tokenText}>{token}</Text>
        </Section>
        <Text style={bodyText}>
          请返回登录页面输入验证码完成登录。
        </Text>
        <Text style={bodyText}>验证码将在有效期后失效。</Text>
        <Text style={bodyText}>
          如果这不是您的操作，请忽略此邮件。
        </Text>
        <Text style={footer}>
          此邮件由系统自动发送，请勿回复。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const title = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const bodyText = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 12px',
}
const tokenSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
}
const tokenText = {
  fontSize: '36px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#000000',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
