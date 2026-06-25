"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function StepWarningsAlert({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null

  return (
    <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-50">
      <AlertTitle>You can continue — please review</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-inside list-disc gap-0.5 text-sm">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

export function GenerateErrorsAlert({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertTitle>Cannot generate until these are fixed</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-inside list-disc gap-0.5 text-sm">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
