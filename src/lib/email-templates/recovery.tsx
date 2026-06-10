import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: Props) => (
  <LioneLayout preview="密码重置通知 / Password Reset Request">
    <Text style={styles.h1}>密码重置通知</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>我们收到了一项密码重置请求。</Text>
    <Text style={styles.text}>
      如果这是您本人操作，请点击下方按钮设置新的密码：
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        重置密码 Reset Password
      </Button>
    </Section>
    <Text style={styles.textMuted}>
      此链接仅可使用一次，并将在一定时间后失效。
    </Text>
    <Text style={styles.textMuted}>
      如果您并未请求重置密码，请忽略此邮件，您的账户和密码不会受到任何影响。
    </Text>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>We received a request to reset your password.</Text>
    <Text style={styles.text}>
      If this request was made by you, please click the button above to create a
      new password.
    </Text>
    <Text style={styles.textMuted}>
      This link can only be used once and will expire after a period of time.
    </Text>
    <Text style={styles.textMuted}>
      If you did not request a password reset, you may safely ignore this email.
    </Text>
  </LioneLayout>
)

export default RecoveryEmail
