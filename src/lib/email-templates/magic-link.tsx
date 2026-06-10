import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({ confirmationUrl, token }: Props) => (
  <LioneLayout preview="登录链接 / Sign In Link">
    <Text style={styles.h1}>登录链接</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>请点击下方按钮登录系统：</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        登录 Sign In
      </Button>
    </Section>
    {token ? (
      <>
        <Text style={styles.textMuted}>或使用以下验证码 / Or use the code:</Text>
        <Text style={styles.code}>{token}</Text>
      </>
    ) : null}
    <Text style={styles.textMuted}>如果您没有请求登录，请忽略此邮件。</Text>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>Please click the button above to sign in.</Text>
    <Text style={styles.textMuted}>
      If you did not request this sign-in link, you may safely ignore this email.
    </Text>
  </LioneLayout>
)

export default MagicLinkEmail
