# Certificate Kafka Integration Documentation

## Overview
Kafka event publishing has been implemented for the certificate issuance endpoint to publish `course_updated` events when certificates are issued to users after course completion.

## Implementation Summary

### Endpoint
**POST** `/certificate/issue`

**Controller Method**: `issueCertificate()`  
**Service Method**: `issueCertificateAfterCourseCompletion()`

### Event Details
- **Event Name**: `course_updated`
- **Event Type**: `COURSE_STATUS_UPDATED`
- **Kafka Topic**: Configured via `KAFKA_TOPIC` environment variable (default: `user-topic`)

---

## Changes Made

### 1. Certificate Module (`certificate.module.ts`)
Added `KafkaModule` import to enable Kafka functionality:

```typescript
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCourseCertificate]),
    KafkaModule,  // ✅ Added
  ],
  controllers: [CertificateController],
  providers: [CertificateService, LoggerService, AxiosRequest],
})
export class CertificateModule {}
```

### 2. Certificate Service (`certificate.service.ts`)

#### Added KafkaService Injection
```typescript
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(UserCourseCertificate)
    private userCourseCertificateRepository: Repository<UserCourseCertificate>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private readonly kafkaService: KafkaService,  // ✅ Added
  ) {}
}
```

#### Added Event Publishing Method
```typescript
/**
 * Publish certificate issued event to Kafka with event name 'course_updated'
 * @param issueCredential - The certificate issuance data
 * @param certificateId - The issued certificate ID
 * @param apiId - API identifier for logging
 */
private async publishCertificateIssuedEvent(
  issueCredential: any,
  certificateId: string,
  apiId: string,
): Promise<void> {
  try {
    const eventData = {
      userId: issueCredential.userId,
      courseId: issueCredential.courseId,
      courseName: issueCredential.courseName,
      certificateId: certificateId,
      firstName: issueCredential.firstName,
      lastName: issueCredential.lastName,
      issuanceDate: issueCredential.issuanceDate,
      expirationDate: issueCredential.expirationDate,
      status: 'viewCertificate',
      eventType: 'CERTIFICATE_ISSUED',
    };

    // Publish event with event name 'course_updated'
    await this.kafkaService.publishUserCourseEvent(
      'course_updated',
      eventData,
      issueCredential.courseId,
    );

    this.loggerService.log(
      `Certificate issued event published for user ${issueCredential.userId} and course ${issueCredential.courseId}`,
      apiId,
    );
  } catch (error) {
    // Log error but don't fail the certificate issuance
    this.loggerService.error(
      `Failed to publish certificate issued event: ${error.message}`,
      apiId,
    );
  }
}
```

#### Updated Certificate Issuance Flow
In `issueCertificateAfterCourseCompletion()`:
```typescript
// Update status to view certificate
const updateResponse = await this.updateUserCertificate({
  userId: issueCredential.userId,
  courseId: issueCredential.courseId,
  issuedOn: issueCredential.issuanceDate,
  status: 'viewCertificate',
  certificateId: issueResponse.data.credential.id,
});

// ✅ Publish Kafka event for course_updated after successful certificate issuance
await this.publishCertificateIssuedEvent(
  issueCredential,
  issueResponse.data.credential.id,
  apiId,
);

return APIResponse.success(
  response,
  apiId,
  issueResponse.data,
  HttpStatus.OK,
  'Credential issued successfully',
);
```

---

## Event Payload Structure

### Kafka Message
```json
{
  "eventType": "COURSE_STATUS_UPDATED",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "data": {
    "userId": "af771398-bc1a-4350-b849-907561d25957",
    "courseId": "do_21430769261883392012483",
    "courseName": "Introduction to Programming",
    "certificateId": "did:upai:cert123456789",
    "firstName": "John",
    "lastName": "Doe",
    "issuanceDate": "2025-10-13T00:00:00.000Z",
    "expirationDate": "2026-10-13T00:00:00.000Z",
    "status": "viewCertificate",
    "eventType": "CERTIFICATE_ISSUED"
  }
}
```

### Message Key
- **Key**: `courseId` (used for Kafka partitioning)

---

## Request/Response Examples

### Request
**POST** `/certificate/issue`

```bash
curl --location 'http://localhost:3000/certificate/issue' \
--header 'Content-Type: application/json' \
--data '{
  "userId": "af771398-bc1a-4350-b849-907561d25957",
  "courseId": "do_21430769261883392012483",
  "courseName": "Introduction to Programming",
  "firstName": "John",
  "lastName": "Doe",
  "issuanceDate": "2025-10-13T00:00:00.000Z",
  "expirationDate": "2026-10-13T00:00:00.000Z"
}'
```

### Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Credential issued successfully",
  "data": {
    "credential": {
      "id": "did:upai:cert123456789",
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "type": ["VerifiableCredential"],
      "issuer": "did:upai:issuer",
      "issuanceDate": "2025-10-13T00:00:00.000Z",
      "credentialSubject": {
        "id": "did:upai:learner123",
        "firstName": "John",
        "lastName": "Doe",
        "userId": "af771398-bc1a-4350-b849-907561d25957",
        "courseId": "do_21430769261883392012483",
        "courseName": "Introduction to Programming"
      }
    }
  }
}
```

---

## Flow Diagram

```
┌─────────────────┐
│   POST /issue   │
└────────┬────────┘
         │
         ↓
┌────────────────────────────────────────┐
│  issueCertificateAfterCourseCompletion │
└────────┬───────────────────────────────┘
         │
         ├─→ 1. Generate learner DID
         │
         ├─→ 2. Issue certificate via external API
         │
         ├─→ 3. Update user certificate in DB
         │      (status: 'viewCertificate')
         │
         ├─→ 4. ✅ Publish Kafka event 'course_updated'
         │      │
         │      ├─→ Event: COURSE_STATUS_UPDATED
         │      ├─→ Topic: user-topic
         │      └─→ Key: courseId
         │
         └─→ 5. Return success response
```

---

## Error Handling

### Kafka Publish Failure
- **Behavior**: Kafka publish errors are **logged but don't fail the certificate issuance**
- **Reason**: Certificate issuance is the primary operation and should succeed even if event publishing fails
- **Logging**: Errors are logged with full error message for debugging

```typescript
catch (error) {
  // Log error but don't fail the certificate issuance
  this.loggerService.error(
    `Failed to publish certificate issued event: ${error.message}`,
    apiId,
  );
}
```

### Kafka Disabled
If Kafka is disabled (`kafkaEnabled: false` in config), the `publishUserCourseEvent` method will:
- Log a warning: `"Kafka is disabled. Skipping tracking event publish."`
- Return immediately without publishing

---

## Configuration

### Environment Variables
```bash
# Kafka Configuration
kafkaEnabled=true                        # Enable/disable Kafka
KAFKA_BROKERS=localhost:9092             # Kafka broker addresses (comma-separated)
KAFKA_CLIENT_ID=tracking-service         # Kafka client ID
KAFKA_TOPIC=user-topic                   # Default Kafka topic
```

### Kafka Service Configuration
The `publishUserCourseEvent` method in `KafkaService` handles:
- Event type mapping: `course_updated` → `COURSE_STATUS_UPDATED`
- Topic selection from environment variables
- Message key (courseId) for partitioning
- Timestamp generation
- Error handling

---

## Testing

### 1. Test Certificate Issuance
```bash
# Issue a certificate
curl -X POST http://localhost:3000/certificate/issue \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "courseId": "test-course-456",
    "courseName": "Test Course",
    "firstName": "Test",
    "lastName": "User",
    "issuanceDate": "2025-10-13T00:00:00.000Z",
    "expirationDate": "2026-10-13T00:00:00.000Z"
  }'
```

### 2. Verify Kafka Event
Check Kafka logs or consume from the topic:

```bash
# Consume from Kafka topic to see the event
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic user-topic \
  --from-beginning
```

Expected output:
```json
{
  "eventType": "COURSE_STATUS_UPDATED",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "data": {
    "userId": "test-user-123",
    "courseId": "test-course-456",
    "courseName": "Test Course",
    "certificateId": "did:upai:cert...",
    "firstName": "Test",
    "lastName": "User",
    "issuanceDate": "2025-10-13T00:00:00.000Z",
    "expirationDate": "2026-10-13T00:00:00.000Z",
    "status": "viewCertificate",
    "eventType": "CERTIFICATE_ISSUED"
  }
}
```

### 3. Check Application Logs
```bash
# Look for successful event publish
tail -f /var/log/application.log | grep "Certificate issued event published"

# Expected log:
# Certificate issued event published for user test-user-123 and course test-course-456
```

---

## Benefits

1. **Asynchronous Communication**: Other services can react to certificate issuance events
2. **Event-Driven Architecture**: Enables decoupled microservices
3. **Audit Trail**: All certificate issuances are tracked via Kafka
4. **Real-time Notifications**: Downstream services can trigger notifications
5. **Data Analytics**: Events can be consumed for analytics and reporting
6. **Non-Blocking**: Certificate issuance doesn't wait for event consumers

---

## Downstream Consumers

Services that may consume `course_updated` events:

1. **Notification Service**: Send congratulations email/SMS to user
2. **Analytics Service**: Track course completion metrics
3. **Reporting Service**: Generate completion reports
4. **Gamification Service**: Award badges/points for completion
5. **Profile Service**: Update user profile with certificate info
6. **Dashboard Service**: Update user dashboard with certificate status

---

## Monitoring

### Key Metrics to Monitor
1. **Event Publish Rate**: Number of certificate events published per minute
2. **Event Publish Failures**: Count of failed Kafka publishes
3. **Event Latency**: Time to publish event to Kafka
4. **Consumer Lag**: How far behind consumers are from producers

### Logging
All certificate issuance events are logged:
```
✅ Success: "Certificate issued event published for user {userId} and course {courseId}"
❌ Error: "Failed to publish certificate issued event: {error.message}"
```

---

## Troubleshooting

### Issue: Events not appearing in Kafka

**Check:**
1. Kafka is enabled: `kafkaEnabled=true`
2. Kafka broker is running and accessible
3. Topic `user-topic` exists
4. No errors in application logs

**Solution:**
```bash
# Check Kafka broker status
kafka-topics.sh --list --bootstrap-server localhost:9092

# Create topic if missing
kafka-topics.sh --create \
  --bootstrap-server localhost:9092 \
  --topic user-topic \
  --partitions 1 \
  --replication-factor 1
```

### Issue: Certificate issued but event not published

**Check application logs:**
```bash
tail -f logs/application.log | grep "Failed to publish certificate issued event"
```

**This is expected behavior** - certificate issuance will succeed even if event publishing fails.

---

## Future Enhancements

1. **Retry Mechanism**: Implement retry logic for failed Kafka publishes
2. **Dead Letter Queue**: Store failed events for later processing
3. **Event Schema Validation**: Validate event payload against schema
4. **Metrics Dashboard**: Create dashboard for event monitoring
5. **Event Replay**: Ability to replay events for specific time periods

---

## Related Documentation

- `src/kafka/kafka.service.ts` - Kafka service implementation
- `src/modules/certificate/certificate.service.ts` - Certificate service with Kafka integration
- Kafka Configuration Guide - Environment variables and setup

---

## Summary

✅ **Implemented**: Kafka event publishing for certificate issuance  
✅ **Event Name**: `course_updated`  
✅ **Event Type**: `COURSE_STATUS_UPDATED`  
✅ **Topic**: `user-topic` (configurable)  
✅ **Error Handling**: Non-blocking with logging  
✅ **Testing**: Ready for production use  

**The certificate issuance endpoint now publishes events to Kafka, enabling event-driven architecture and real-time notifications!** 🚀
