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

	platformconfig "home-searcher/server/internal/platform/config"
)

// S3Store stores artifacts in an S3-compatible object store such as Garage.
type S3Store struct {
	client    *s3.Client
	bucket    string
	keyPrefix string
}

// NewS3Store builds a Garage-compatible S3 client.
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

// Put stores a raw object in the configured S3 bucket.
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

// Get reads a raw object from the configured S3 bucket.
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

func (s *S3Store) withPrefix(key string) string {
	if s.keyPrefix == "" {
		return strings.TrimLeft(key, "/")
	}

	return s.keyPrefix + "/" + strings.TrimLeft(key, "/")
}
