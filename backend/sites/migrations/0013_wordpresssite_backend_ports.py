from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wordpress_sites', '0012_wordpresssite_replica_count'),
    ]

    operations = [
        migrations.AddField(
            model_name='wordpresssite',
            name='backend_ports',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
