"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dices, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

// no look-alike characters, since an admin may read it out to someone
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 16) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join(
    "",
  );
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  disabled,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          onChange(generatePassword());
          setVisible(true);
        }}
        disabled={disabled}
        aria-label="Generate a password"
        title="Generate a password"
      >
        <Dices />
      </Button>
    </div>
  );
}
