import fixtureData from './fixtures/display-events.json'
import type { DisplayEvent } from './displayEvents.js'
import type { PermissionCard } from './displayTypes.js'

export type DesktopDisplayEventFixtureSet = {
  events: DisplayEvent[]
  permission: PermissionCard
}

export const DESKTOP_DISPLAY_EVENT_FIXTURES =
  fixtureData as DesktopDisplayEventFixtureSet

export function getDesktopDisplayEventFixtures(): DesktopDisplayEventFixtureSet {
  return DESKTOP_DISPLAY_EVENT_FIXTURES
}
