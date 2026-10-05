import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useCreateUser } from '@/hooks/useAuth'

export function CreateOperatorForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const createUser = useCreateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createUser.mutate(
      { name, email, password, role: 'operator' },
      {
        onSuccess: () => {
          setName('')
          setEmail('')
          setPassword('')
          toast.success('Operator account created')
        },
        onError: (error) =>
          toast.error(
            (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
              'Failed to create operator account',
          ),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create operator account</CardTitle>
        <CardDescription>Admin only — new accounts are created with the operator role</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
          </div>
          <Button type="submit" disabled={createUser.isPending} className="w-fit">
            {createUser.isPending ? 'Creating…' : 'Create operator'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
