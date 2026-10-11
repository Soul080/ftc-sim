/** Keyboard actions shared by the settings panel and the drive loop. */
export interface KeyMap {
  forward: string;
  back: string;
  strafeLeft: string;
  strafeRight: string;
  turnLeft: string;
  turnRight: string;
  intake: string;
  launch: string;
  deposit: string;
  eject: string;
  hoodUp: string;
  hoodDown: string;
  nectar: string;
  precision: string;
  fieldCentric: string;
  turretLeft: string;
  turretRight: string;
}

export const RED_KEYS: KeyMap = {
  forward: "KeyW",
  back: "KeyS",
  strafeLeft: "KeyA",
  strafeRight: "KeyD",
  turnLeft: "KeyQ",
  turnRight: "KeyE",
  intake: "KeyF",
  launch: "KeyG",
  deposit: "KeyV",
  eject: "KeyX",
  hoodUp: "Digit1",
  hoodDown: "Digit2",
  nectar: "KeyZ",
  precision: "ShiftLeft",
  fieldCentric: "KeyT",
  turretLeft: "BracketLeft",
  turretRight: "BracketRight",
};

export const BLUE_KEYS: KeyMap = {
  forward: "ArrowUp",
  back: "ArrowDown",
  strafeLeft: "ArrowLeft",
  strafeRight: "ArrowRight",
  turnLeft: "KeyK",
  turnRight: "KeyL",
  intake: "Semicolon",
  launch: "Quote",
  deposit: "Slash",
  eject: "Period",
  hoodUp: "Digit9",
  hoodDown: "Digit0",
  nectar: "KeyB",
  precision: "ShiftRight",
  fieldCentric: "",
  turretLeft: "KeyO",
  turretRight: "KeyP",
};

export const KEY_ACTIONS: Array<{ id: keyof KeyMap; label: string }> = [
  { id: "forward", label: "Forward" },
  { id: "back", label: "Back" },
  { id: "strafeLeft", label: "Strafe left" },
  { id: "strafeRight", label: "Strafe right" },
  { id: "turnLeft", label: "Turn left" },
  { id: "turnRight", label: "Turn right" },
  { id: "intake", label: "Intake" },
  { id: "launch", label: "Launch / fire" },
  { id: "deposit", label: "Deposit" },
  { id: "eject", label: "Spit one out" },
  { id: "hoodUp", label: "Hood up" },
  { id: "hoodDown", label: "Hood down" },
  { id: "nectar", label: "Enter nectar" },
  { id: "precision", label: "Precision (hold)" },
  { id: "fieldCentric", label: "Field / robot" },
  { id: "turretLeft", label: "Turret left" },
  { id: "turretRight", label: "Turret right" },
];
