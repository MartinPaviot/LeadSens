import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  cc: z.string().optional(),
})

const RECIPIENT = "contact@elevay.app"

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const formData = await req.formData()

    const parsed = schema.safeParse({
      subject: formData.get("subject"),
      message: formData.get("message"),
      urgency: formData.get("urgency"),
      cc: formData.get("cc") ?? undefined,
    })

    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { subject, message, urgency, cc } = parsed.data
    const attachment = formData.get("attachment") as File | null

    const senderName = session.user.name ?? "Unknown"
    const senderEmail = session.user.email

    // Build urgency label
    const urgencyLabel = urgency.charAt(0).toUpperCase() + urgency.slice(1)

    // Build email body
    const textBody = [
      `From: ${senderName} (${senderEmail})`,
      `Urgency: ${urgencyLabel}`,
      cc ? `CC: ${cc}` : null,
      "",
      "---",
      "",
      message,
    ]
      .filter((line) => line !== null)
      .join("\n")

    const fullSubject = `[${urgencyLabel}] ${subject}`

    // Try Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      const ccList = cc
        ? cc.split(",").map((e) => e.trim()).filter(Boolean)
        : undefined

      // Build Resend payload
      const resendPayload: Record<string, unknown> = {
        from: `Elevay Contact <noreply@elevay.app>`,
        to: [RECIPIENT],
        reply_to: senderEmail,
        subject: fullSubject,
        text: textBody,
      }

      if (ccList && ccList.length > 0) {
        resendPayload.cc = ccList
      }

      // Handle attachment if present
      if (attachment && attachment.size > 0) {
        const buffer = await attachment.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        resendPayload.attachments = [
          {
            filename: attachment.name,
            content: base64,
          },
        ]
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      })

      if (!resendRes.ok) {
        const err = await resendRes.text()
        return Response.json({ error: "EMAIL_SEND_FAILED" }, { status: 500 })
      }

      return Response.json({ success: true })
    }

    // Fallback: dev mode without Resend — silently succeed
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
