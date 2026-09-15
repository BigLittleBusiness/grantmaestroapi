import '../src/env.js'
import {
  runGrantDeadlineWarnings,
  runSubscriptionExpiryWarnings,
  runAcquittalReminders,
} from '../src/scheduledJobs.js'

try {
  await runGrantDeadlineWarnings()
  await runSubscriptionExpiryWarnings()
  await runAcquittalReminders()
  console.log('Notification health check passed')
  process.exit(0)
} catch (error) {
  console.error('Notification health check failed:', error)
  process.exit(1)
}
