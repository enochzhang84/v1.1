import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { LioneLayout, styles } from './_layout'

interface Props {
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: Props) => (
  <LioneLayout preview="您已被邀请加入系统 / You are invited">
    <Text style={styles.h1}>您已被邀请加入系统</Text>
    <Text style={styles.langLabel}>中文</Text>
    <Text style={styles.text}>您好，</Text>
    <Text style={styles.text}>您已被邀请加入系统。</Text>
    <Text style={styles.text}>请点击下方按钮接受邀请并设置账户：</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        接受邀请 Accept Invitation
      </Button>
    </Section>
    <Section style={styles.divider} />
    <Text style={styles.langLabel}>English</Text>
    <Text style={styles.text}>Hello,</Text>
    <Text style={styles.text}>You have been invited to join the system.</Text>
    <Text style={styles.text}>
      Please click the button above to accept the invitation and set up your
      account.
    </Text>
  </LioneLayout>
)

export default InviteEmail
