class StyledFormMixin:
    
    '''Adiciona classes CSS, IDs e placeholders automaticamente 
    a todos os campos do formulário'''

    default_input_class = 'form-control'  # Alera conforme o estilo global(Bootstrap, Taiwind, etc.)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for field_name, field in self.fields.items():
            widget = field.widget

            # Classe CSS
            old_classes = widget.attrs.get('class', '')
            widget.attrs['class'] = f'{old_classes}{self.default_input_class}'.strip()

            # ID único
            widget.attrs.setdefault('id', f'{field_name}')

            # Label seguro 
            label = getattr(field, 'label', None) or field_name
            if callable(label):
                label = label()

            label_text = str(label).replace('_', '').capitalize()

            # Placeholder automático (ex: 'Digite seu email')
            
            placeholder = widget.attrs.setdefault('placeholder', f'{label_text.capitalize()}')
            widget.attrs.setdefault('placeholder', placeholder)