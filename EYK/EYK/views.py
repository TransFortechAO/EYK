from django.shortcuts import redirect, render
from django.contrib.auth.decorators import login_required


def index(request):
    if request.user.is_authenticated:
        return redirect('feed:home')
    else:
        return render(request, 'index.html')
