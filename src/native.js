// deq inside the iPhone app (Capacitor). The screens are the same React code; this file
// holds the few things that differ from Safari.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export const isNative = Capacitor.isNativePlatform()

// In the app, pages load from the phone itself, so server calls go to deq.one by full address.
export const api = path => (isNative ? 'https://deq.one' : '') + path

// Haptics: real taps in the iPhone app, silent everywhere else. Keep them for moments that matter.
const safe = run => (isNative ? run().catch(() => {}) : Promise.resolve())
export const haptic = {
  tick: () => safe(() => Haptics.selectionChanged()),
  tap: () => safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  firm: () => safe(() => Haptics.impact({ style: ImpactStyle.Medium })),
  success: () => safe(() => Haptics.notification({ type: NotificationType.Success })),
  warning: () => safe(() => Haptics.notification({ type: NotificationType.Warning })),
}
