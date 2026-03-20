import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-08-27.basil",
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature") || ""

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  console.log("Received webhook event:", event.type)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const tier = session.metadata?.tier || "pro"

        console.log("Checkout completed - userId:", userId, "tier:", tier)

        if (userId && tier) {
          console.log(`Processing checkout completed for user ${userId}, tier: ${tier}`)

          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
          console.log("Calling backend webhook at:", `${apiUrl}/auth/webhook/subscription`)

          const response = await fetch(`${apiUrl}/auth/webhook/subscription`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: parseInt(userId),
              tier: tier,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            }),
          })

          const responseText = await response.text()
          console.log("Backend webhook response:", response.status, responseText)

          if (!response.ok) {
            console.error("Failed to update subscription:", responseText)
          } else {
            console.log("Subscription updated successfully")
          }
        } else {
          console.error("Missing userId or tier in metadata:", { userId, tier })
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Subscription updated:", subscription.id)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        console.log("Subscription cancelled:", subscription.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Error processing webhook:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
