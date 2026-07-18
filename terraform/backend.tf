terraform {
  backend "s3" {
    bucket         = "grantmaestro-terraform-state-backend-434978747146"
    key            = "terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = "true"
    dynamodb_table = "grantmaestro-terraform-locks"
  }
}
