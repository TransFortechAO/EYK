# Create your models here.

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    is_student = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    bio = models.CharField(max_length=100, null=False)
    morada = models.CharField(max_length=200, null=False)


    def __str__(self):
        return self.username