import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  confirmationUrl: string
}

export const SignupEmail = ({ confirmationUrl }: Props) => (
  <LioneLayout preview="确认您的邮箱 / Confirm your email">
    <Text style={styles.h1}>确认您的邮箱</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>感谢您注册使用系统。</Text>
    <Text style={styles.text}>请点击下方按钮确认您的邮箱：</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        确认邮箱 Confirm Email
      </Button>
    </Section>
    <Text style={styles.textMuted}>
      如果这不是您本人操作，请忽略此邮件。
    </Text>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>Thank you for signing up.</Text>
    <Text style={styles.text}>
      Please click the button above to confirm your email address.
    </Text>
    <Text style={styles.textMuted}>
      If you did not create this account, you may safely ignore this email.
    </Text>
  </LioneLayout>
)

export default SignupEmail
