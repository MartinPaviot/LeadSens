'use client'

import { useState } from 'react'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { useSettingsContext } from './settings-context'
import { Plus, Trash } from '@phosphor-icons/react'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-600',
}

export function TeamTab() {
  const { data, loading, reload } = useSettingsContext()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) { toast.error('Valid email required'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (res.status === 409) { toast.error('Already a member'); return }
      if (!res.ok) throw new Error('Failed')
      toast.success('Member invited')
      setShowInvite(false)
      setInviteEmail('')
      setInviteRole('viewer')
      await reload()
    } catch {
      toast.error('Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    try {
      const res = await fetch(`/api/settings/team?id=${memberId}`, { method: 'DELETE' })
      if (res.status === 403) { toast.error('Cannot remove the owner'); return }
      if (!res.ok) throw new Error('Failed')
      toast.success('Member removed')
      setDeleting(null)
      await reload()
    } catch {
      toast.error('Failed to remove')
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>

  const members = data?.members ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Team Members</h2>
        <Button size="sm" onClick={() => setShowInvite(true)} className="text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
          <Plus className="size-4 mr-1" /> Invite
        </Button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <Card>
          <CardHeader><CardTitle className="text-base">Invite a member</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleInvite()} disabled={inviting} className="text-white font-semibold" style={{ background: 'var(--elevay-gradient-btn)' }}>
                {inviting ? 'Inviting...' : 'Send invite'}
              </Button>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No team members yet.</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {(member.user.name?.[0] ?? member.user.email[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.user.name ?? member.user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer}`}>
                      {member.role}
                    </span>
                    {member.role !== 'owner' && (
                      deleting === member.id ? (
                        <div className="flex gap-1">
                          <Button variant="destructive" size="sm" onClick={() => void handleRemove(member.id)}>Remove</Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(member.id)} className="text-destructive">
                          <Trash className="size-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
