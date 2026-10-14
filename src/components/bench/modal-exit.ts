"use client";

import { createContext } from "react";

/**
 * How a `Modal` animates out — passed down from `DialogTrigger`, which owns
 * whether a dialog is mounted.
 *
 * A dialog that unmounts the moment it's closed can't slide away: there is
 * nothing left to animate. So closing is two steps. The dialog's `onClose`
 * only marks it `closing`; the trigger keeps it mounted; `Modal` plays its
 * exit and calls `exited`, and only then does the trigger unmount it. Every
 * close goes through this, a Save as much as the ✕, because they all call
 * the same `onClose`.
 *
 * `null` outside a trigger: such a Modal closes at once, unanimated.
 */
export const ModalExit = createContext<{ closing: boolean; exited: () => void } | null>(null);
