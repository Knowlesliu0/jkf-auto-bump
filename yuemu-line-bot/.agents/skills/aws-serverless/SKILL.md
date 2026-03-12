---
name: aws-serverless
description: Agent skill for architecting, developing, and deploying AWS Serverless applications.
---
# AWS Serverless Skill

This skill provides guidelines for the AI assistant when working on AWS Serverless architectures.

## Best Practices

When asked to implement or modify AWS Serverless components, follow these guidelines:

1. **Infrastructure as Code (IaC)**: Always define infrastructure using tools like AWS CDK (preferred), Serverless Framework (SST), or AWS SAM rather than manual console configuration.
2. **Compute (Lambda)**: 
   - Keep Lambda functions single-purposed and stateless.
   - Separate business logic from the Lambda handler to facilitate unit testing.
   - Monitor and optimize cold start times (e.g., configuring Provisioned Concurrency if necessary, or optimizing bundle size).
3. **API & Routing**: Use Amazon API Gateway for RESTful/WebSocket APIs, or AWS Lambda Function URLs for simpler use-cases.
4. **Data Storage**: 
   - Prefer Amazon DynamoDB for NoSQL needs. Use single-table design where appropriate.
   - Use Amazon S3 for binary/large object storage.
5. **Event-Driven Architecture**: Connect decoupled services using Amazon EventBridge (custom events), Amazon SQS (queueing/buffering), and Amazon SNS (pub/sub).
6. **Security & IAM**: 
   - Adhere strictly to the Principle of Least Privilege. Each Lambda function should have its own IAM role with only the necessary permissions.
7. **Observability**: Ensure logging via Amazon CloudWatch. Use structured JSON logging for better query capabilities.
