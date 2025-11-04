from django.core.management.base import BaseCommand
from django.db import transaction, connection, DatabaseError
from stories.models import CustomUser, Project, UserStory, Wireframe, Scenario, ProjectHistory, Export, GenerationSession

class Command(BaseCommand):
    help = 'Clear all seeded data from the database with safety checks'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--all-users',
            action='store_true',
            help='Delete all users (including non-demo ones) - USE WITH CAUTION',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt',
        )
        parser.add_argument(
            '--skip-users',
            action='store_true',
            help='Skip deleting users, only delete project data',
        )
    
    def _confirm_operation(self, options):
        """Handle confirmation prompts"""
        if options['force']:
            return True
            
        if options['all_users']:
            confirm = input(
                '❌ WARNING: This will delete ALL users including admin accounts. '
                'Are you sure? (yes/no): '
            )
            return confirm.lower() == 'yes'
        else:
            confirm = input('⚠️  This will delete all project data. Continue? (yes/no): ')
            return confirm.lower() == 'yes'
    
    def handle(self, *args, **options):
        self.stdout.write('🗑️  Starting data cleanup...')
        
        # Safety check - require confirmation for destructive operations
        if not self._confirm_operation(options):
            self.stdout.write('🚫 Operation cancelled.')
            return
        
        try:
            # First, handle project data deletion in a transaction
            with transaction.atomic():
                self._delete_project_data()
            
            # Then handle user deletion separately
            if not options['skip_users']:
                self._delete_users_separately(options)
            
            # Verify cleanup
            self._verify_cleanup(options)
            
            self.stdout.write(
                self.style.SUCCESS('\n🎉 Data cleanup completed successfully!')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'💥 Error during cleanup: {str(e)}')
            )
            self.stdout.write('🚫 Operation failed')
    
    def _delete_project_data(self):
        """Delete all project-related data in a transaction"""
        # Get counts before deletion for reporting
        counts = {
            'exports': Export.objects.count(),
            'scenarios': Scenario.objects.count(),
            'wireframes': Wireframe.objects.count(),
            'user_stories': UserStory.objects.count(),
            'sessions': GenerationSession.objects.count(),
            'history': ProjectHistory.objects.count(),
            'projects': Project.objects.count(),
        }
        
        self.stdout.write('📊 Current data counts:')
        for model, count in counts.items():
            self.stdout.write(f'   {model}: {count}')
        
        # Delete in correct order to respect foreign key constraints
        self.stdout.write('\n🧹 Deleting project data...')
        
        Export.objects.all().delete()
        self.stdout.write('✅ Deleted all exports')
        
        Scenario.objects.all().delete()
        self.stdout.write('✅ Deleted all scenarios')
        
        Wireframe.objects.all().delete()
        self.stdout.write('✅ Deleted all wireframes')
        
        UserStory.objects.all().delete()
        self.stdout.write('✅ Deleted all user stories')
        
        GenerationSession.objects.all().delete()
        self.stdout.write('✅ Deleted all generation sessions')
        
        ProjectHistory.objects.all().delete()
        self.stdout.write('✅ Deleted all project history')
        
        Project.objects.all().delete()
        self.stdout.write('✅ Deleted all projects')
    
    def _delete_users_separately(self, options):
        """Delete users separately from project data to avoid transaction issues"""
        self.stdout.write('\n👥 Deleting users...')
        
        if options['all_users']:
            user_count = CustomUser.objects.count()
            
            if user_count > 0:
                # First try with ORM in a separate transaction
                try:
                    with transaction.atomic():
                        # Since we don't have is_superuser field, delete all users
                        CustomUser.objects.all().delete()
                        self.stdout.write(f'✅ Deleted all {user_count} users using ORM')
                            
                except DatabaseError as e:
                    # If ORM fails, use raw SQL outside of transaction
                    self.stdout.write('⚠️  ORM deletion failed, using raw SQL...')
                    self._delete_users_raw_sql(options)
            else:
                self.stdout.write('ℹ️  No users to delete')
        else:
            # Delete only demo users - this should work fine
            demo_users = CustomUser.objects.filter(username__startswith='demo_')
            count = demo_users.count()
            if count > 0:
                demo_users.delete()
                self.stdout.write(f'✅ Deleted {count} demo users')
            else:
                self.stdout.write('ℹ️  No demo users to delete')
    
    def _delete_users_raw_sql(self, options):
        """Delete users using raw SQL outside of transaction constraints"""
        try:
            # Use a new database connection to avoid transaction issues
            with connection.cursor() as cursor:
                # Get table name from CustomUser model
                table_name = CustomUser._meta.db_table
                
                # Delete all users (no superuser distinction in our model)
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                total_count = cursor.fetchone()[0]
                cursor.execute(f"DELETE FROM {table_name}")
                self.stdout.write(f'✅ Deleted all {total_count} users using raw SQL')
                
        except DatabaseError as e:
            self.stdout.write(
                self.style.ERROR(f'💥 Raw SQL deletion failed: {str(e)}')
            )
            # If raw SQL also fails, try one more approach
            self._delete_users_final_attempt(options)
    
    def _delete_users_final_attempt(self, options):
        """Final attempt to delete users by disabling constraints temporarily"""
        self.stdout.write('🔄 Trying final approach...')
        
        try:
            with connection.cursor() as cursor:
                table_name = CustomUser._meta.db_table
                
                if connection.vendor == 'postgresql':
                    # For PostgreSQL, we can disable triggers temporarily
                    cursor.execute("SET session_replication_role = 'replica'")
                    
                    cursor.execute(f"DELETE FROM {table_name}")
                    self.stdout.write('✅ Deleted all users (final attempt)')
                    
                    # Re-enable triggers
                    cursor.execute("SET session_replication_role = 'origin'")
                    
                else:
                    # For other databases, try simple delete
                    cursor.execute(f"DELETE FROM {table_name}")
                    self.stdout.write('✅ Deleted all users (final attempt)')
                        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'💥 All deletion methods failed: {str(e)}')
            )
            self.stdout.write('⚠️  You may need to delete users manually from the database')
    
    def _verify_cleanup(self, options):
        """Verify that data was properly cleaned up"""
        self.stdout.write('\n🔍 Verification:')
        remaining_data = False
        
        # Check project-related models
        project_models = [Export, Scenario, Wireframe, UserStory, GenerationSession, ProjectHistory, Project]
        for model in project_models:
            if model.objects.exists():
                self.stdout.write(self.style.WARNING(f'   ⚠️  {model.__name__} still has data'))
                remaining_data = True
        
        if not remaining_data:
            self.stdout.write('   ✅ All project data cleared successfully')
        
        # Check user cleanup
        if not options['skip_users']:
            user_count = CustomUser.objects.count()
            if user_count > 0:
                if options['all_users']:
                    self.stdout.write(self.style.WARNING(f'   ⚠️  {user_count} users still exist'))
                else:
                    demo_count = CustomUser.objects.filter(username__startswith='demo_').count()
                    if demo_count > 0:
                        self.stdout.write(self.style.WARNING(f'   ⚠️  {demo_count} demo users still exist'))
                    else:
                        self.stdout.write('   ✅ All demo users cleared successfully')
            else:
                self.stdout.write('   ✅ All users cleared successfully')