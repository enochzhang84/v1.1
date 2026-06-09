import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>重置您的 {siteName} 管理员密码</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>重置管理员密码</Heading>
        <Text style={text}>
          您正在重置 {siteName} 管理后台密码。请点击下方按钮设置新密码。
        </Text>
        <Button style={button} href={confirmationUrl}>
          重置密码
        </Button>
        <Text style={footer}>
          如果不是您本人操作，请忽略此邮件，您的密码不会被更改。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#059669',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
