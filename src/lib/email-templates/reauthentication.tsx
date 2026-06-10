import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  token: string
}

export const ReauthenticationEmail = ({ token }: Props) => (
  <LioneLayout preview="重新认证验证码 / Reauthentication Code">
    <Text style={styles.h1}>重新认证验证码</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>您正在进行安全认证。</Text>
    <Text style={styles.text}>验证码：</Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.textMuted}>此验证码将在短时间内失效。</Text>
    <Text style={styles.textMuted}>
      如果这不是您本人操作，请忽略此邮件。
    </Text>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>You are completing a security verification.</Text>
    <Text style={styles.text}>Verification code:</Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.textMuted}>This code will expire shortly.</Text>
    <Text style={styles.textMuted}>
      If you did not request this verification, you may safely ignore this email.
    </Text>
  </LioneLayout>
)

export default ReauthenticationEmail
