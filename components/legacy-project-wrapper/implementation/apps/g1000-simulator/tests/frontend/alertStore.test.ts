import { useAlertStore } from '../../frontend/src/stores/alertStore'

describe('G1000 alert store', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [] })
  })

  it('uses common lifecycle ordering and retains the private three-alert display limit', () => {
    const { addAlert } = useAlertStore.getState()

    addAlert({ level: 'advisory', message: 'advisory' })
    addAlert({ level: 'warning', message: 'warning' })
    addAlert({ level: 'caution', message: 'caution' })
    addAlert({ level: 'warning', message: 'later warning' })

    expect(useAlertStore.getState().alerts.map(({ message }) => message)).toEqual([
      'warning',
      'later warning',
      'caution',
    ])
  })

  it('places unacknowledged alerts before acknowledged alerts on the next insertion', () => {
    const { addAlert } = useAlertStore.getState()

    addAlert({ level: 'warning', message: 'acknowledged warning' })
    const warningId = useAlertStore.getState().alerts[0].id
    useAlertStore.getState().acknowledgeAlert(warningId)
    addAlert({ level: 'caution', message: 'active caution' })

    expect(useAlertStore.getState().alerts.map(({ message }) => message)).toEqual([
      'active caution',
      'acknowledged warning',
    ])
  })
})
