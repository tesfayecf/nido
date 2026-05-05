/**
 * File: internal/platform/objectstore/s3.go
 *
 * Purpose:
 * Implements backend behavior for the objectstore package.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - bytes
 * - context
 * - fmt
 * - io
 * - strings
 * - github.com/aws/aws-sdk-go-v2/aws
 * - github.com/aws/aws-sdk-go-v2/config
 * - github.com/aws/aws-sdk-go-v2/credentials
 * - github.com/aws/aws-sdk-go-v2/service/s3
 * - nido/server/internal/platform/config
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package objectstore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	platformconfig "nido/server/internal/platform/config"
)

/**
 * Purpose:
 * Defines the S3Store struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type S3Store struct {
	client    *s3.Client
	bucket    string
	keyPrefix string
}

/**
 * Purpose:
 * Performs the NewS3Store operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, cfg platformconfig.ObjectStoreConfig
 *
 * Returns:
 * - (*S3Store, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func NewS3Store(ctx context.Context, cfg platformconfig.ObjectStoreConfig) (*S3Store, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, "")),
		awsconfig.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{URL: cfg.S3Endpoint, HostnameImmutable: true}, nil
				}

				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			}),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.UsePathStyle = true
	})

	return &S3Store{
		client:    client,
		bucket:    cfg.S3Bucket,
		keyPrefix: strings.Trim(cfg.S3KeyPrefix, "/"),
	}, nil
}

/**
 * Purpose:
 * Performs the Put operation for this backend package.
 *
 * Parameters:
 * - s *S3Store
 *
 * Returns:
 * - Put(ctx context.Context, input PutInput) (PutResult, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *S3Store) Put(ctx context.Context, input PutInput) (PutResult, error) {
	key := s.withPrefix(input.Key)

	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(input.Body),
		ContentType: aws.String(input.ContentType),
	})
	if err != nil {
		return PutResult{}, fmt.Errorf("put object %q: %w", key, err)
	}

	return PutResult{Key: key, Size: int64(len(input.Body))}, nil
}

/**
 * Purpose:
 * Performs the Get operation for this backend package.
 *
 * Parameters:
 * - s *S3Store
 *
 * Returns:
 * - Get(ctx context.Context, key string) ([]byte, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *S3Store) Get(ctx context.Context, key string) ([]byte, error) {
	resolvedKey := s.withPrefix(key)

	response, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(resolvedKey),
	})
	if err != nil {
		return nil, fmt.Errorf("get object %q: %w", resolvedKey, err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("read object %q: %w", resolvedKey, err)
	}

	return body, nil
}

/**
 * Purpose:
 * Performs the withPrefix operation for this backend package.
 *
 * Parameters:
 * - s *S3Store
 *
 * Returns:
 * - withPrefix(key string) string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (s *S3Store) withPrefix(key string) string {
	if s.keyPrefix == "" {
		return strings.TrimLeft(key, "/")
	}

	return s.keyPrefix + "/" + strings.TrimLeft(key, "/")
}
