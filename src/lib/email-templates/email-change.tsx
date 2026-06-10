import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  confirmationUrl: string
  oldEmail?: string
  newEmail?: string
}

export const EmailChangeEmail = ({
  confirmationUrl,
  oldEmail,
  newEmail,
}: Props) => (
  <LioneLayout preview="确认邮箱变更 / Confirm Email Change">
    <Text style={styles.h1}>确认邮箱变更</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>我们收到邮箱变更请求。</Text>
    {oldEmail && newEmail ? (
      <Text style={styles.textMuted}>
        从 {oldEmail} 变更为 {newEmail}
      </Text>
    ) : null}
    <Text style={styles.text}>请点击下方按钮确认新的邮箱地址：</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        确认邮箱变更 Confirm Email Change
      </Button>
    </Section>
    <Text style={styles.textMuted}>
      如果这不是您本人操作，请立即联系系统管理员。
    </Text>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>
      We received a request to change your email address.
    </Text>
    <Text style={styles.text}>
      Please click the button above to confirm your new email address.
    </Text>
    <Text style={styles.textMuted}>
      If you did not request this change, please contact your system
      administrator immediately.
    </Text>
  </LioneLayout>
)

export default EmailChangeEmail
