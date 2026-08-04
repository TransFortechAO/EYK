from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render


def index(request):
    if request.user.is_authenticated:
        return redirect('feed:home')
    else:
        return render(request, 'index.html')