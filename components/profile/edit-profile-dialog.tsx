"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/trip";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onSave: () => void;
}

export function EditProfileDialog({ open, onOpenChange, profile, onChange, onSave }: EditProfileDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl data-[state=open]:animate-slide-up focus:outline-none"
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">Edit profile</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-foreground-secondary">
                Stored locally on this device until sign-in launches.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Name</span>
              <Input
                value={profile.displayName}
                onChange={(event) => onChange({ ...profile, displayName: event.target.value })}
                placeholder="Your name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
              <Input
                type="email"
                value={profile.email}
                onChange={(event) => onChange({ ...profile, email: event.target.value })}
                placeholder="you@email.com"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave();
                onOpenChange(false);
              }}
            >
              Save profile
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
