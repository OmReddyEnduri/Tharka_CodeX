import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Settings {
  theme: string;
  fontSize: number;
  keybinding: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => void;
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editor Settings</DialogTitle>
          <DialogDescription>
            Customize your coding environment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, theme: value })
              }
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vs">VS Light</SelectItem>
                <SelectItem value="vs-dark">VS Dark</SelectItem>
                <SelectItem value="hc-black">High Contrast Dark</SelectItem>
                <SelectItem value="hc-light">High Contrast Light</SelectItem>
                <SelectItem value="dracula">Dracula</SelectItem>
                <SelectItem value="monokai">Monokai</SelectItem>
                <SelectItem value="nord">Nord</SelectItem>
                <SelectItem value="github-light">GitHub Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="font-size">Font Size</Label>
            <Select
              value={String(settings.fontSize)}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, fontSize: Number(value) })
              }
            >
              <SelectTrigger id="font-size">
                <SelectValue placeholder="Font Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="14">14</SelectItem>
                <SelectItem value="16">16</SelectItem>
                <SelectItem value="18">18</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-center">
            <Label htmlFor="keybinding">Keybinding</Label>
            <Select
              value={settings.keybinding}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, keybinding: value })
              }
            >
              <SelectTrigger id="keybinding">
                <SelectValue placeholder="Keybinding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="vim">Vim</SelectItem>
                <SelectItem value="emacs">Emacs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
