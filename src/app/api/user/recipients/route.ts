import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const AddRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().max(255).optional(),
})

// GET - list all recipients for current user
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: recipients, error } = await supabaseAdmin
      .from('digest_recipients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ recipients: recipients || [] })
  } catch (error) {
    console.error('Get recipients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - add a new recipient
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name } = AddRecipientSchema.parse(body)

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from('digest_recipients')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already added as a recipient' },
        { status: 409 }
      )
    }

    // Limit to 10 recipients
    const { count } = await supabaseAdmin
      .from('digest_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count !== null && count >= 10) {
      return NextResponse.json(
        { error: 'Maximum of 10 recipients allowed' },
        { status: 400 }
      )
    }

    const { data: recipient, error } = await supabaseAdmin
      .from('digest_recipients')
      .insert({
        user_id: user.id,
        email,
        name: name || null,
        confirmed: true, // auto-confirm for now
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ recipient }, { status: 201 })
  } catch (error) {
    console.error('Add recipient error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - remove a recipient
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const recipientId = searchParams.get('id')

    if (!recipientId) {
      return NextResponse.json({ error: 'Recipient ID required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('digest_recipients')
      .delete()
      .eq('id', recipientId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete recipient error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
